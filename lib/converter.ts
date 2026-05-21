import { spawn } from "node:child_process";
import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";

const YT_DLP = process.env.YT_DLP_PATH || "yt-dlp";
const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";

export type ConvertProgress =
  | { phase: "downloading" }
  | { phase: "converting" }
  | { phase: "done"; filePath: string; fileName: string };

export type ConvertResult = {
  filePath: string;
  fileName: string;
};

/**
 * Reads MP3_NORMALIZE_LUFS from env. Returns null if unset or out of the
 * loudnorm filter's accepted range (I=-70..-5), so callers can skip
 * normalization without throwing on misconfiguration.
 */
function parseLufsTarget(): number | null {
  const raw = process.env.MP3_NORMALIZE_LUFS;
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < -70 || n > -5) return null;
  return n;
}

/**
 * Downloads a YouTube URL as an mp3 file. yt-dlp handles both download
 * and the ffmpeg-backed audio extraction in a single call when given
 * `-x --audio-format mp3` (yt-dlp invokes ffmpeg internally).
 */
export async function convertToMp3(
  url: string,
  onProgress?: (p: ConvertProgress) => void,
): Promise<ConvertResult> {
  const jobDir = path.join(tmpdir(), `mp3-curator-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  await mkdir(jobDir, { recursive: true });
  const outTemplate = path.join(jobDir, "%(title)s.%(ext)s");

  return new Promise((resolve, reject) => {
    const args = [
      "-x",
      "--audio-format",
      "mp3",
      "--audio-quality",
      "0",
      "--no-playlist",
      "--ffmpeg-location",
      FFMPEG,
      "-o",
      outTemplate,
      url,
    ];

    const child = spawn(YT_DLP, args, { windowsHide: true });
    let printed = "";
    let stderr = "";
    let sawDownload = false;
    let sawConverting = false;

    onProgress?.({ phase: "downloading" });

    child.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      printed += text;
      if (!sawDownload && /\[download\]/.test(text)) {
        sawDownload = true;
        onProgress?.({ phase: "downloading" });
      }
      if (!sawConverting && /\[ExtractAudio\]|Destination: .*\.mp3/.test(text)) {
        sawConverting = true;
        onProgress?.({ phase: "converting" });
      }
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", (err) => {
      reject(new Error(`Failed to spawn yt-dlp: ${err.message}`));
    });

    child.on("close", async (code) => {
      if (code !== 0) {
        reject(new Error(`yt-dlp exited ${code}: ${stderr || printed}`));
        return;
      }
      try {
        // Discover the produced mp3 by reading our dedicated job dir, which
        // sidesteps any stdout-encoding issues with non-ASCII titles on
        // Windows. yt-dlp deletes the intermediate webm so only the mp3
        // remains here.
        const entries = await readdir(jobDir);
        const mp3 = entries.find((e) => e.toLowerCase().endsWith(".mp3"));
        if (!mp3) {
          reject(new Error(`no mp3 produced (jobDir entries: ${entries.join(", ")})`));
          return;
        }
        const rawPath = path.join(jobDir, mp3);

        const lufs = parseLufsTarget();
        let finalPath = rawPath;
        if (lufs !== null) {
          if (!sawConverting) onProgress?.({ phase: "converting" });
          const normalizedPath = path.join(jobDir, `normalized-${mp3}`);
          await runLoudnorm(rawPath, normalizedPath, lufs);
          finalPath = normalizedPath;
        }

        onProgress?.({ phase: "done", filePath: finalPath, fileName: mp3 });
        resolve({ filePath: finalPath, fileName: mp3 });
      } catch (err) {
        reject(err);
      }
    });
  });
}

/**
 * Runs ffmpeg's EBU R128 loudnorm filter to retarget integrated loudness.
 * Single-pass is enough for our use case — two-pass is more accurate but
 * doubles the wall-clock time per file.
 */
function runLoudnorm(input: string, output: string, targetLufs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      "-y",
      "-i",
      input,
      "-af",
      `loudnorm=I=${targetLufs}:TP=-2:LRA=11`,
      "-c:a",
      "libmp3lame",
      "-q:a",
      "0",
      output,
    ];
    const child = spawn(FFMPEG, args, { windowsHide: true });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", (err) => {
      reject(new Error(`Failed to spawn ffmpeg: ${err.message}`));
    });
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg loudnorm exited ${code}: ${stderr.slice(-500)}`));
        return;
      }
      resolve();
    });
  });
}

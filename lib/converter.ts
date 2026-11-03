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
 * Loudness normalization applied while extracting audio, so songs from
 * different uploads play back at a similar volume.
 * - I=-10   integrated loudness target in LUFS
 * - TP=-1.0 true-peak ceiling in dBTP, leaves headroom against clipping
 * - LRA=11  loudness range target in LU
 *
 * Why -10 and not the streaming reference -14: these files are played in
 * local players that do not normalize, next to commercial masters around
 * -5 to -9 LUFS, so -14 sounded ~6–8 dB too quiet. Measured: a loud master
 * (-7.8) lands at -9.5, a quiet live take (-23.8) at -11.2 — the TP ceiling
 * keeps quiet sources from going higher. Trade-off: ballads/live lose some
 * dynamics (LRA 10.9 → 5.8); dance/hip-hop (LRA ~2–3) are unaffected.
 * Going to -9 gained only ~0.7 dB on loud songs while widening the gap.
 *
 * Single-pass: about 1–2 LU of error, but no extra decode per song.
 */
export const LOUDNORM_FILTER = "loudnorm=I=-10:TP=-1.0:LRA=11";

export function buildYtDlpArgs(url: string, outTemplate: string, ffmpeg: string): string[] {
  return [
    "-x",
    "--audio-format",
    "mp3",
    "--audio-quality",
    "0",
    "--no-playlist",
    "--ffmpeg-location",
    ffmpeg,
    // Hand the filter to the ffmpeg run that ExtractAudio performs (output side).
    "--postprocessor-args",
    `ExtractAudio+ffmpeg_o:-af ${LOUDNORM_FILTER}`,
    "-o",
    outTemplate,
    url,
  ];
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
    const args = buildYtDlpArgs(url, outTemplate, FFMPEG);

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
        const filePath = path.join(jobDir, mp3);
        onProgress?.({ phase: "done", filePath, fileName: mp3 });
        resolve({ filePath, fileName: mp3 });
      } catch (err) {
        reject(err);
      }
    });
  });
}

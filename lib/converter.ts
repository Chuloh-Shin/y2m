import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
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
      "--print",
      "after_move:filepath",
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

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`yt-dlp exited ${code}: ${stderr || printed}`));
        return;
      }
      const lines = printed.trim().split(/\r?\n/);
      const filePath = lines[lines.length - 1]?.trim();
      if (!filePath) {
        reject(new Error("yt-dlp did not print an output filepath"));
        return;
      }
      const fileName = path.basename(filePath);
      onProgress?.({ phase: "done", filePath, fileName });
      resolve({ filePath, fileName });
    });
  });
}

"use server";

import { convertToMp3 } from "@/lib/converter";
import {
  createJob,
  getJobStatus as getJobStatusFromStore,
  hasActiveJob,
  setItemStatus,
  updateItem,
} from "@/lib/jobs";
import { generateSongList as generateSongListFromLlm } from "@/lib/llm";
import { searchTopMatch } from "@/lib/youtube";
import type { JobStatus, Song, SongJobItem } from "@/types/song";

export type StartJobResult =
  | { ok: true; jobId: string }
  | { ok: false; reason: "busy" | "invalid" };

export async function startUrlConversion(url: string): Promise<StartJobResult> {
  if (!url || !/^https?:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//.test(url)) {
    return { ok: false, reason: "invalid" };
  }
  if (hasActiveJob()) {
    return { ok: false, reason: "busy" };
  }

  const item: SongJobItem = {
    title: url,
    artist: "",
    youtubeUrl: url,
    thumbnailUrl: "",
    selected: true,
    status: "pending",
  };
  const job = createJob("url", [item]);

  // Fire-and-forget. dev server keeps process alive long enough.
  void runUrlConversion(job.id, url);

  return { ok: true, jobId: job.id };
}

async function runUrlConversion(jobId: string, url: string) {
  try {
    setItemStatus(jobId, 0, "downloading");
    const result = await convertToMp3(url, (p) => {
      if (p.phase === "converting") {
        setItemStatus(jobId, 0, "converting");
      }
    });
    updateItem(jobId, 0, {
      status: "done",
      title: result.fileName.replace(/\.mp3$/i, ""),
      downloadName: result.fileName,
      filePath: result.filePath,
    });
  } catch (err) {
    setItemStatus(jobId, 0, "failed", {
      failureReason: (err as Error).message.slice(0, 200),
    });
  }
}

export async function getJobStatus(jobId: string): Promise<JobStatus | null> {
  return getJobStatusFromStore(jobId);
}

export type GenerateSongListResult =
  | { ok: true; songs: Song[] }
  | { ok: false; reason: "llm-failed" | "invalid-input" };

export async function generateSongList(
  query: string,
  count: number,
): Promise<GenerateSongListResult> {
  const trimmed = query.trim();
  if (!trimmed) return { ok: false, reason: "invalid-input" };
  const n = Math.max(1, Math.min(50, Math.floor(count)));

  try {
    const seeds = await generateSongListFromLlm(trimmed, n);
    const songs: Song[] = await Promise.all(
      seeds.map(async (seed) => {
        const match = await searchTopMatch(`${seed.artist} ${seed.title}`).catch(
          () => null,
        );
        return {
          title: seed.title,
          artist: seed.artist,
          youtubeUrl: match?.url ?? "",
          thumbnailUrl: match?.thumbnailUrl ?? "",
        };
      }),
    );
    // Drop entries that have no usable YouTube URL — they cannot be converted.
    return { ok: true, songs: songs.filter((s) => s.youtubeUrl) };
  } catch {
    return { ok: false, reason: "llm-failed" };
  }
}

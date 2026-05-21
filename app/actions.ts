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

export async function startPlaylistConversion(
  songs: Song[],
): Promise<StartJobResult> {
  if (!Array.isArray(songs) || songs.length === 0) {
    return { ok: false, reason: "invalid" };
  }
  if (hasActiveJob()) {
    return { ok: false, reason: "busy" };
  }

  const items: SongJobItem[] = songs.map((s) => ({
    title: s.title,
    artist: s.artist,
    youtubeUrl: s.youtubeUrl,
    thumbnailUrl: s.thumbnailUrl,
    selected: true,
    status: "pending",
  }));
  const job = createJob("playlist", items);

  void runPlaylistConversion(job.id);
  return { ok: true, jobId: job.id };
}

async function runPlaylistConversion(jobId: string) {
  // Sequential conversion keeps yt-dlp safe and progress easy to read.
  const startStatus = getJobStatusFromStore(jobId);
  if (!startStatus) return;
  for (let i = 0; i < startStatus.items.length; i += 1) {
    const item = startStatus.items[i];
    if (!item.youtubeUrl) {
      setItemStatus(jobId, i, "failed", { failureReason: "YouTube URL이 없습니다" });
      continue;
    }
    try {
      setItemStatus(jobId, i, "downloading");
      const result = await convertToMp3(item.youtubeUrl, (p) => {
        if (p.phase === "converting") {
          setItemStatus(jobId, i, "converting");
        }
      });
      updateItem(jobId, i, {
        status: "done",
        downloadName: result.fileName,
        filePath: result.filePath,
      });
    } catch (err) {
      setItemStatus(jobId, i, "failed", {
        failureReason: (err as Error).message.slice(0, 200),
      });
    }
  }
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

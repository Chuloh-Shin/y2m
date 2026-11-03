"use server";

import { copyFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { convertToMp3 } from "@/lib/converter";
import {
  createJob,
  getJobStatus as getJobStatusFromStore,
  hasActiveJob,
  setItemStatus,
  updateItem,
} from "@/lib/jobs";
import {
  filterRecent,
  generateSongList as generateSongListFromLlm,
  isRecencyQuery,
} from "@/lib/llm";
import { enrichWithGenres, fetchMelonChart } from "@/lib/melon";
import { parseSongList, searchQueryFor } from "@/lib/songlist";
import { searchTopMatch } from "@/lib/youtube";
import type { JobStatus, Song, SongJobItem } from "@/types/song";

async function copyToDownloads(srcPath: string, fileName: string): Promise<string> {
  const dir = path.join(os.homedir(), "Downloads");
  await mkdir(dir, { recursive: true });
  const dest = path.join(dir, fileName);
  await copyFile(srcPath, dest);
  return dest;
}

export type StartJobResult =
  | { ok: true; jobId: string }
  | { ok: false; reason: "busy" | "invalid" };

export async function startUrlConversion(url: string): Promise<StartJobResult> {
  if (!url || !/^https?:\/\/((www\.|m\.|music\.)?youtube\.com|youtu\.be)\//.test(url)) {
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
    const finalPath = await copyToDownloads(result.filePath, result.fileName);
    updateItem(jobId, 0, {
      status: "done",
      title: result.fileName.replace(/\.mp3$/i, ""),
      downloadName: result.fileName,
      filePath: finalPath,
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
      const finalPath = await copyToDownloads(result.filePath, result.fileName);
      updateItem(jobId, i, {
        status: "done",
        downloadName: result.fileName,
        filePath: finalPath,
      });
    } catch (err) {
      setItemStatus(jobId, i, "failed", {
        failureReason: (err as Error).message.slice(0, 200),
      });
    }
  }
}

/**
 * Current chart songs the LLM may choose from. "최신" means recently
 * released, not merely still charting — so a 2024 hit sitting at #80 is
 * dropped in code. Genres are fetched only for the songs that survive,
 * which keeps Melon requests down.
 */
async function prepareChartCandidates(query: string) {
  const chart = await fetchMelonChart();
  const candidates = isRecencyQuery(query) ? filterRecent(chart, new Date()) : chart;
  return enrichWithGenres(candidates);
}

export type GenerateSongListResult =
  | { ok: true; songs: Song[]; requested: number }
  | { ok: false; reason: "llm-failed" | "invalid-input" };

export async function generateSongList(
  query: string,
  count: number,
): Promise<GenerateSongListResult> {
  const trimmed = query.trim();
  if (!trimmed) return { ok: false, reason: "invalid-input" };
  const n = Math.max(1, Math.min(50, Math.floor(count)));

  // Chart is best-effort: if Melon is down or its markup changed,
  // the LLM falls back to search-grounded recommendation.
  const candidates = await prepareChartCandidates(trimmed).catch(() => undefined);

  try {
    const seeds = await generateSongListFromLlm(trimmed, n, candidates);
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
    // requested is preserved so the UI can tell the user when matches < N.
    return { ok: true, songs: songs.filter((s) => s.youtubeUrl), requested: n };
  } catch {
    return { ok: false, reason: "llm-failed" };
  }
}

export type MatchSongListResult =
  | {
      ok: true;
      songs: Song[];
      requested: number;
      /** "가수 제목" labels of songs YouTube had no match for. */
      unmatched: string[];
      /** Songs cut because the list was longer than MAX_LIST_ITEMS. */
      truncated: number;
    }
  | { ok: false; reason: "invalid-input" };

const SEARCH_CONCURRENCY = 5;

/** Find a YouTube video for every song in a pasted list. */
export async function matchSongList(text: string): Promise<MatchSongListResult> {
  const { songs: seeds, truncated } = parseSongList(text ?? "");
  if (seeds.length === 0) return { ok: false, reason: "invalid-input" };

  const matched: (Song | null)[] = new Array(seeds.length).fill(null);
  for (let i = 0; i < seeds.length; i += SEARCH_CONCURRENCY) {
    await Promise.all(
      seeds.slice(i, i + SEARCH_CONCURRENCY).map(async (seed, j) => {
        const match = await searchTopMatch(searchQueryFor(seed)).catch(() => null);
        if (!match) return;
        matched[i + j] = {
          title: seed.title,
          artist: seed.artist,
          youtubeUrl: match.url,
          thumbnailUrl: match.thumbnailUrl,
        };
      }),
    );
  }

  return {
    ok: true,
    songs: matched.filter((s): s is Song => s !== null),
    requested: seeds.length,
    unmatched: seeds.filter((_, i) => !matched[i]).map(searchQueryFor),
    truncated,
  };
}

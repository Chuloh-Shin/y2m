"use server";

import { convertToMp3 } from "@/lib/converter";
import {
  createJob,
  getJobStatus as getJobStatusFromStore,
  hasActiveJob,
  setItemStatus,
  updateItem,
} from "@/lib/jobs";
import type { JobStatus, SongJobItem } from "@/types/song";

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

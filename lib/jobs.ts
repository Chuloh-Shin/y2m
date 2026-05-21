import type { Job, JobMode, JobStatus, SongJobItem, SongStatus } from "@/types/song";
import { isTerminal } from "@/types/song";

const jobs = new Map<string, Job>();
let activeJobId: string | null = null;

function newId(): string {
  return `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function hasActiveJob(): boolean {
  if (!activeJobId) return false;
  const job = jobs.get(activeJobId);
  if (!job) {
    activeJobId = null;
    return false;
  }
  if (job.items.every((it) => isTerminal(it.status))) {
    activeJobId = null;
    return false;
  }
  return true;
}

export function createJob(mode: JobMode, items: SongJobItem[]): Job {
  if (hasActiveJob()) {
    throw new Error("ANOTHER_JOB_RUNNING");
  }
  const id = newId();
  const job: Job = { id, mode, items, createdAt: Date.now() };
  jobs.set(id, job);
  activeJobId = id;
  return job;
}

export function getJob(id: string): Job | null {
  return jobs.get(id) ?? null;
}

export function getJobStatus(id: string): JobStatus | null {
  const job = jobs.get(id);
  if (!job) return null;
  const terminated = job.items.every((it) => isTerminal(it.status));
  return { id: job.id, mode: job.mode, items: job.items, terminated };
}

export function updateItem(
  id: string,
  index: number,
  patch: Partial<SongJobItem>,
): void {
  const job = jobs.get(id);
  if (!job) return;
  const current = job.items[index];
  if (!current) return;
  job.items[index] = { ...current, ...patch };
}

export function setItemStatus(
  id: string,
  index: number,
  status: SongStatus,
  extra?: Partial<SongJobItem>,
): void {
  updateItem(id, index, { status, ...extra });
}

/** Test helper. */
export function _reset(): void {
  jobs.clear();
  activeJobId = null;
}

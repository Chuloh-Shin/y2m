import { beforeEach, describe, expect, it } from "vitest";
import { _reset, createJob, getJob, getJobStatus, hasActiveJob, setItemStatus } from "./jobs";
import type { SongJobItem } from "@/types/song";

function makeItem(over: Partial<SongJobItem> = {}): SongJobItem {
  return {
    title: "",
    artist: "",
    youtubeUrl: "https://yt.example/x",
    thumbnailUrl: "",
    selected: true,
    status: "pending",
    ...over,
  };
}

describe("jobs store", () => {
  beforeEach(() => _reset());

  it("creates a job and reports it as active", () => {
    const job = createJob("url", [makeItem()]);
    expect(job.items).toHaveLength(1);
    expect(hasActiveJob()).toBe(true);
  });

  it("rejects a second job while one is active", () => {
    createJob("url", [makeItem()]);
    expect(() => createJob("url", [makeItem()])).toThrow(/ANOTHER_JOB_RUNNING/);
  });

  it("releases active slot when all items reach terminal status", () => {
    const job = createJob("url", [makeItem()]);
    setItemStatus(job.id, 0, "done");
    expect(hasActiveJob()).toBe(false);
    // Now a new job can be created.
    expect(() => createJob("url", [makeItem()])).not.toThrow();
  });

  it("getJobStatus reports terminated=true once every item is terminal", () => {
    const job = createJob("playlist", [makeItem(), makeItem()]);
    setItemStatus(job.id, 0, "done");
    setItemStatus(job.id, 1, "failed");
    const status = getJobStatus(job.id);
    expect(status?.terminated).toBe(true);
  });

  it("getJob returns null for unknown id", () => {
    expect(getJob("nope")).toBeNull();
  });
});

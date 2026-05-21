import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProgressScreen } from "./ProgressScreen";
import type { JobStatus, SongJobItem, SongStatus } from "@/types/song";

function makeItem(status: SongStatus, over: Partial<SongJobItem> = {}): SongJobItem {
  return {
    title: "Hype Boy",
    artist: "NewJeans",
    youtubeUrl: "https://yt.example/x",
    thumbnailUrl: "",
    selected: true,
    status,
    ...over,
  };
}

function job(items: SongJobItem[], terminated: boolean): JobStatus {
  return { id: "j1", mode: "url", items, terminated };
}

describe("ProgressScreen", () => {
  it("shows '변환 진행' header while not terminated", () => {
    const j = job([makeItem("downloading")], false);
    render(<ProgressScreen job={j} onReset={vi.fn()} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("변환 진행");
  });

  it("shows '변환 완료' header when all items terminal", () => {
    const j = job([makeItem("done")], true);
    render(<ProgressScreen job={j} onReset={vi.fn()} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("변환 완료");
  });

  it("renders exactly one card for a 1-item URL job", () => {
    const j = job([makeItem("downloading")], false);
    render(<ProgressScreen job={j} onReset={vi.fn()} />);
    expect(screen.getAllByTestId("song-progress-card")).toHaveLength(1);
  });

  it("'새 입력으로' button is disabled while in progress", () => {
    const j = job([makeItem("downloading")], false);
    render(<ProgressScreen job={j} onReset={vi.fn()} />);
    expect(screen.getByRole("button", { name: /새 입력으로/ })).toBeDisabled();
  });

  it("'새 입력으로' button is enabled once terminated", () => {
    const j = job([makeItem("done")], true);
    render(<ProgressScreen job={j} onReset={vi.fn()} />);
    expect(screen.getByRole("button", { name: /새 입력으로/ })).toBeEnabled();
  });
});

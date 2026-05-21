import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SongProgressCard } from "./SongProgressCard";
import type { SongJobItem, SongStatus } from "@/types/song";

function item(over: Partial<SongJobItem> = {}): SongJobItem {
  return {
    title: "Hype Boy",
    artist: "NewJeans",
    youtubeUrl: "https://www.youtube.com/watch?v=abc",
    thumbnailUrl: "",
    selected: true,
    status: "pending",
    ...over,
  };
}

describe("SongProgressCard", () => {
  it("renders title and artist", () => {
    render(
      <ul>
        <SongProgressCard item={item({ status: "done" })} />
      </ul>,
    );
    expect(screen.getByText("Hype Boy")).toBeInTheDocument();
    expect(screen.getByText(/NewJeans/)).toBeInTheDocument();
    expect(screen.getByText(/완료/)).toBeInTheDocument();
  });

  it("falls back to youtubeUrl when title is empty", () => {
    render(
      <ul>
        <SongProgressCard
          item={item({ title: "", artist: "", youtubeUrl: "https://yt.example/abc" })}
        />
      </ul>,
    );
    expect(screen.getByText("https://yt.example/abc")).toBeInTheDocument();
  });

  it("shows failure reason when failed", () => {
    render(
      <ul>
        <SongProgressCard
          item={item({ status: "failed", failureReason: "YouTube에서 못 찾음" })}
        />
      </ul>,
    );
    expect(screen.getByText(/실패 — YouTube에서 못 찾음/)).toBeInTheDocument();
  });

  it.each<SongStatus>(["pending", "searching", "downloading", "converting", "done", "failed"])(
    "exposes data-status=%s",
    (status) => {
      render(
        <ul>
          <SongProgressCard item={item({ status })} />
        </ul>,
      );
      expect(screen.getByTestId("song-progress-card")).toHaveAttribute("data-status", status);
    },
  );
});

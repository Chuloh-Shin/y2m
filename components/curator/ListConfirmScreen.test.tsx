import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ListConfirmScreen } from "./ListConfirmScreen";
import type { Song } from "@/types/song";

function makeSongs(n: number): Song[] {
  return Array.from({ length: n }, (_, i) => ({
    title: `Song ${i + 1}`,
    artist: `Artist ${i + 1}`,
    youtubeUrl: `https://www.youtube.com/watch?v=v${i}`,
    thumbnailUrl: `https://example.com/thumb${i}.jpg`,
  }));
}

type Over = Partial<React.ComponentProps<typeof ListConfirmScreen>>;
function renderList(over: Over = {}) {
  const props: React.ComponentProps<typeof ListConfirmScreen> = {
    query: "댄스곡",
    songs: makeSongs(5),
    regenerating: false,
    onStartDownload: vi.fn(),
    onRegenerate: vi.fn().mockResolvedValue(undefined),
    onEditInput: vi.fn(),
    ...over,
  };
  return { ...render(<ListConfirmScreen {...props} />), props };
}

describe("ListConfirmScreen", () => {
  it("renders N items with title, artist, thumbnail, and 미리 듣기 link", () => {
    renderList();
    const items = screen.getAllByTestId("song-list-item");
    expect(items).toHaveLength(5);
    items.forEach((item, i) => {
      const w = within(item);
      expect(w.getByText(`Song ${i + 1}`)).toBeInTheDocument();
      expect(w.getByText(`Artist ${i + 1}`)).toBeInTheDocument();
      // Thumbnail rendered as <img>.
      expect(item.querySelector("img")).toHaveAttribute(
        "src",
        `https://example.com/thumb${i}.jpg`,
      );
      // External link to YouTube.
      const link = w.getByRole("link");
      expect(link).toHaveAttribute("href", `https://www.youtube.com/watch?v=v${i}`);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    });
  });

  it("starts with every item checked", () => {
    renderList();
    screen.getAllByTestId("song-list-item").forEach((item) => {
      expect(item).toHaveAttribute("data-checked", "true");
    });
  });

  it("shows '5곡 중 5곡 선택됨' counter and '다운로드 시작 (5곡)' label initially", () => {
    renderList();
    expect(screen.getByText(/5곡 중 5곡 선택됨/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /다운로드 시작 \(5곡\)/ })).toBeInTheDocument();
  });

  it("updates counter and label when checkboxes toggle", async () => {
    const user = userEvent.setup();
    renderList();
    const items = screen.getAllByTestId("song-list-item");
    await user.click(within(items[1]).getByRole("checkbox"));
    await user.click(within(items[3]).getByRole("checkbox"));
    expect(screen.getByText(/5곡 중 3곡 선택됨/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /다운로드 시작 \(3곡\)/ })).toBeInTheDocument();
  });

  it("applies visual treatment (opacity, strike) to unchecked items", async () => {
    const user = userEvent.setup();
    renderList();
    const item = screen.getAllByTestId("song-list-item")[1];
    await user.click(within(item).getByRole("checkbox"));
    expect(item).toHaveAttribute("data-checked", "false");
    expect(item.className).toMatch(/opacity-50/);
    expect(within(item).getByText("Song 2").className).toMatch(/line-through/);
  });

  it("disables 다운로드 시작 when no item is selected", async () => {
    const user = userEvent.setup();
    renderList({ songs: makeSongs(2) });
    for (const item of screen.getAllByTestId("song-list-item")) {
      await user.click(within(item).getByRole("checkbox"));
    }
    expect(screen.getByRole("button", { name: /다운로드 시작 \(0곡\)/ })).toBeDisabled();
  });

  it("passes only checked songs to onStartDownload", async () => {
    const user = userEvent.setup();
    const { props } = renderList();
    const items = screen.getAllByTestId("song-list-item");
    await user.click(within(items[1]).getByRole("checkbox"));
    await user.click(within(items[3]).getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /다운로드 시작 \(3곡\)/ }));
    expect(props.onStartDownload).toHaveBeenCalledTimes(1);
    const passed = (props.onStartDownload as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(passed).toHaveLength(3);
    expect(passed.map((s: Song) => s.title)).toEqual(["Song 1", "Song 3", "Song 5"]);
  });

  it("calls onRegenerate when 다시 생성 is clicked", async () => {
    const user = userEvent.setup();
    const { props } = renderList();
    await user.click(screen.getByRole("button", { name: /다시 생성/ }));
    expect(props.onRegenerate).toHaveBeenCalled();
  });

  it("calls onEditInput when either 입력 수정 trigger is clicked", async () => {
    const user = userEvent.setup();
    const { props } = renderList();
    const triggers = screen.getAllByRole("button", { name: /입력 수정/ });
    expect(triggers).toHaveLength(2); // header back-link + footer action
    await user.click(triggers[1]);
    expect(props.onEditInput).toHaveBeenCalled();
  });

  it("disables action buttons while regenerating", () => {
    renderList({ regenerating: true });
    expect(screen.getByRole("button", { name: /다운로드 시작/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /다시 생성/ })).toBeDisabled();
    const editTriggers = screen.getAllByRole("button", { name: /입력 수정/ });
    expect(editTriggers[1]).toBeDisabled();
  });
});

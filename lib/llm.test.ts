import { describe, expect, it } from "vitest";
import { parseSongSeeds, pickChartEntries } from "./llm";
import type { ChartEntry } from "@/types/song";

const chart: ChartEntry[] = [
  { rank: 1, title: "With", artist: "RESCENE (리센느)" },
  { rank: 2, title: "NEON", artist: "A2O, A2O LITE" },
  { rank: 3, title: "꿈꾸던 어른이 되었나요?", artist: "경서예지" },
];

describe("pickChartEntries", () => {
  it("maps picked ranks to chart songs in the model's order", () => {
    expect(pickChartEntries([2, 1], chart, 5)).toEqual([
      { title: "NEON", artist: "A2O, A2O LITE" },
      { title: "With", artist: "RESCENE (리센느)" },
    ]);
  });

  it("drops ranks that are not on the chart and duplicates", () => {
    expect(pickChartEntries([99, 2, 2, "1"], chart, 5)).toEqual([
      { title: "NEON", artist: "A2O, A2O LITE" },
    ]);
  });

  it("caps the result at count", () => {
    expect(pickChartEntries([1, 2, 3], chart, 2)).toHaveLength(2);
  });

  it("returns [] for an empty or malformed selection", () => {
    expect(pickChartEntries([], chart, 5)).toEqual([]);
    expect(pickChartEntries({ rank: 1 }, chart, 5)).toEqual([]);
  });
});

describe("parseSongSeeds", () => {
  it("parses a bare JSON array", () => {
    const text = '[{"title":"LEMONADE","artist":"aespa"}]';
    expect(parseSongSeeds(text)).toEqual([
      { title: "LEMONADE", artist: "aespa" },
    ]);
  });

  it("unwraps a ```json code fence", () => {
    const text =
      '```json\n[{"title":"JUMP","artist":"BLACKPINK"},{"title":"SPAGHETTI","artist":"LE SSERAFIM"}]\n```';
    expect(parseSongSeeds(text)).toEqual([
      { title: "JUMP", artist: "BLACKPINK" },
      { title: "SPAGHETTI", artist: "LE SSERAFIM" },
    ]);
  });

  it("ignores prose surrounding the array", () => {
    const text =
      '다음은 추천 곡입니다:\n[{"title":"404","artist":"KiiiKiii"}]\n이상입니다.';
    expect(parseSongSeeds(text)).toEqual([
      { title: "404", artist: "KiiiKiii" },
    ]);
  });

  it("drops entries missing title or artist and trims whitespace", () => {
    const text =
      '[{"title":" Looks Can Kill ","artist":"IVE"},{"title":"","artist":"X"},{"artist":"Y"}]';
    expect(parseSongSeeds(text)).toEqual([
      { title: "Looks Can Kill", artist: "IVE" },
    ]);
  });

  it("throws when no JSON array is present", () => {
    expect(() => parseSongSeeds("검색 결과가 없습니다.")).toThrow();
  });
});

import { describe, expect, it } from "vitest";
import {
  filterRecent,
  formatChartLine,
  isRecencyQuery,
  parseSongSeeds,
  pickChartEntries,
} from "./llm";
import type { ChartEntry } from "@/types/song";

const chart: ChartEntry[] = [
  { rank: 1, title: "With", artist: "RESCENE (리센느)" },
  { rank: 2, title: "NEON", artist: "A2O, A2O LITE" },
  { rank: 3, title: "꿈꾸던 어른이 되었나요?", artist: "경서예지" },
];

describe("isRecencyQuery", () => {
  it.each([
    "2026년 11월 기준 20대 여성이 좋아하는 최신 아이돌 댄스곡",
    "요즘 신곡",
    "최근 유행하는 노래",
  ])("treats %s as a recency query", (q) => {
    expect(isRecencyQuery(q)).toBe(true);
  });

  it("does not treat a plain taste query as recency", () => {
    expect(isRecencyQuery("2000년대 미국 힙합")).toBe(false);
  });
});

describe("filterRecent", () => {
  const now = new Date("2026-11-03T12:00:00Z");
  const songs: ChartEntry[] = [
    { rank: 1, title: "With", artist: "RESCENE", releasedOn: "2026-10-26" },
    { rank: 32, title: "Spring Song", artist: "aespa", releasedOn: "2026-03-10" },
    { rank: 80, title: "Whiplash", artist: "aespa", releasedOn: "2024-10-18" },
    { rank: 90, title: "Unknown", artist: "Z" },
  ];

  it("drops songs released more than 6 months ago, e.g. Whiplash (2024-10)", () => {
    expect(filterRecent(songs, now).map((e) => e.title)).toEqual(["With", "Unknown"]);
  });

  it("keeps songs whose release date is unknown", () => {
    expect(filterRecent(songs, now).some((e) => e.title === "Unknown")).toBe(true);
  });

  it("honours a custom window", () => {
    expect(filterRecent(songs, now, 12).map((e) => e.title)).toEqual([
      "With",
      "Spring Song",
      "Unknown",
    ]);
  });
});

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

  it("caps each artist at 2 songs and keeps going to fill the list", () => {
    const albumDrop: ChartEntry[] = [
      { rank: 1, title: "With", artist: "RESCENE (리센느)" },
      { rank: 3, title: "백화요란", artist: "RESCENE (리센느)" },
      { rank: 4, title: "Finest Thing", artist: "RESCENE (리센느)" },
      { rank: 7, title: "MEME", artist: "RESCENE (리센느)" },
      { rank: 10, title: "체포하겠어", artist: "아일릿(ILLIT)" },
    ];
    expect(pickChartEntries([1, 3, 4, 7, 10], albumDrop, 5).map((s) => s.title)).toEqual([
      "With",
      "백화요란",
      "체포하겠어",
    ]);
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

describe("formatChartLine", () => {
  it("shows genre and release month in brackets", () => {
    expect(
      formatChartLine({ rank: 25, title: "꾼", artist: "PLAVE", genre: "R&B/Soul", releasedOn: "2026-10-07" }),
    ).toBe("25. 꾼 — PLAVE [R&B/Soul, 2026-10]");
  });

  it("omits the brackets when nothing is known", () => {
    expect(formatChartLine({ rank: 1, title: "With", artist: "RESCENE" })).toBe("1. With — RESCENE");
  });
});

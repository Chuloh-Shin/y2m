import { describe, expect, it } from "vitest";
import { parseSongSeeds } from "./llm";

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

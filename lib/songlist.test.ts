import { describe, expect, it } from "vitest";
import { MAX_LIST_ITEMS, parseSongList, searchQueryFor } from "./songlist";

const USER_EXAMPLE = `조선힙합
-답정너
-세상은 요지경
-꽃길이라하더니
-힘들다는말
-생각보다 안망한다
-봄비가 내려와
-인생뭐있나

가수 : 김버거
-쉬었음 청년

제목만
-hot honey
-7 rings
-눈꽃이피면
-벚꽃이 피기 시작하면
-보이지않는 선 위에서
-사는게 다 그렇지머
-마음의 숲
-뺑덕어멈 나가신다
-무너져 난
-자유롭게 빛나
-이거 맞나봐요
-사랑때문에 내 인생은
-이젠 안녕`;

describe("parseSongList", () => {
  it("parses the grouped example into 21 songs with the right artists", () => {
    const { songs, truncated } = parseSongList(USER_EXAMPLE);
    expect(songs).toHaveLength(21);
    expect(truncated).toBe(0);
    expect(songs[0]).toEqual({ title: "답정너", artist: "조선힙합" });
    expect(songs[6]).toEqual({ title: "인생뭐있나", artist: "조선힙합" });
    expect(songs[7]).toEqual({ title: "쉬었음 청년", artist: "김버거" });
    expect(songs[8]).toEqual({ title: "hot honey", artist: "" });
    expect(songs[20]).toEqual({ title: "이젠 안녕", artist: "" });
  });

  it.each([
    ["가수 : 김버거", "김버거"],
    ["가수: 김버거", "김버거"],
    ["아티스트：IU", "IU"],
    ["Artist: IU", "IU"],
    ["조선힙합:", "조선힙합"],
  ])("reads header %s as artist %s", (header, artist) => {
    expect(parseSongList(`${header}\n- 노래`).songs).toEqual([{ title: "노래", artist }]);
  });

  it.each(["제목만", "제목", "제목만:"])("treats header %s as title-only", (header) => {
    expect(parseSongList(`${header}\n- 7 rings`).songs).toEqual([{ title: "7 rings", artist: "" }]);
  });

  it("accepts bullets, numbering and various dashes", () => {
    const text = "제목만\n• 하나\n* 둘\n1. 셋\n2) 넷\n– 다섯\n— 여섯\n· 일곱";
    expect(parseSongList(text).songs.map((s) => s.title)).toEqual([
      "하나", "둘", "셋", "넷", "다섯", "여섯", "일곱",
    ]);
  });

  it("treats a plain one-per-line list as titles", () => {
    expect(parseSongList("hot honey\n7 rings").songs).toEqual([
      { title: "hot honey", artist: "" },
      { title: "7 rings", artist: "" },
    ]);
  });

  it("splits a standalone 'artist - title' line", () => {
    expect(parseSongList("아이유 - 밤편지").songs).toEqual([{ title: "밤편지", artist: "아이유" }]);
  });

  it("does not split a hyphen without spaces", () => {
    expect(parseSongList("K-pop Song").songs).toEqual([{ title: "K-pop Song", artist: "" }]);
  });

  it("keeps the artist across blank lines until the next header", () => {
    const text = "가수 : A\n- a1\n\n- a2\n가수 : B\n- b1";
    expect(parseSongList(text).songs).toEqual([
      { title: "a1", artist: "A" },
      { title: "a2", artist: "A" },
      { title: "b1", artist: "B" },
    ]);
  });

  it("drops duplicates (same artist and title, case-insensitive)", () => {
    expect(parseSongList("제목만\n- 7 rings\n- 7 Rings").songs).toHaveLength(1);
  });

  it(`caps the list at ${MAX_LIST_ITEMS} and reports how many were cut`, () => {
    const text = Array.from({ length: MAX_LIST_ITEMS + 5 }, (_, i) => `- song ${i}`).join("\n");
    const { songs, truncated } = parseSongList(text);
    expect(songs).toHaveLength(MAX_LIST_ITEMS);
    expect(truncated).toBe(5);
  });

  it("returns nothing for blank input", () => {
    expect(parseSongList("  \n\n ").songs).toEqual([]);
  });
});

describe("searchQueryFor", () => {
  it("prefixes the artist when known", () => {
    expect(searchQueryFor({ title: "쉬었음 청년", artist: "김버거" })).toBe("김버거 쉬었음 청년");
  });

  it("uses the title alone when the artist is unknown", () => {
    expect(searchQueryFor({ title: "7 rings", artist: "" })).toBe("7 rings");
  });
});

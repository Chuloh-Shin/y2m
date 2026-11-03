import type { SongSeed } from "@/types/song";

/** Same ceiling as the taste mode's count, to keep one job a sensible size. */
export const MAX_LIST_ITEMS = 50;

// "- 제목", "• 제목", "* 제목", "1. 제목", "2) 제목", en/em dash, middle dot.
const ITEM_MARKER = /^(?:[-–—•*·]|\d+[.)])\s*/;
const ARTIST_LABEL = /^(?:가수|아티스트|artist)\s*[:：]\s*/i;
const TITLE_ONLY = /^(?:제목만|제목|titles?(?: only)?)\s*[:：]?$/i;

export type ParsedSongList = {
  songs: SongSeed[];
  /** Songs dropped because the list exceeded MAX_LIST_ITEMS. */
  truncated: number;
};

function headerToArtist(line: string): string {
  if (TITLE_ONLY.test(line)) return "";
  return line.replace(ARTIST_LABEL, "").replace(/\s*[:：]\s*$/, "").trim();
}

/**
 * Parse a pasted song list.
 *
 * - Lines starting with a bullet/number are titles.
 * - A plain line followed by such titles is a group header naming the
 *   artist ("조선힙합", "가수 : 김버거"); "제목만" means no artist.
 * - A plain line not followed by titles is itself a song; "아티스트 - 제목"
 *   (hyphen with spaces) is split into artist and title.
 */
export function parseSongList(text: string): ParsedSongList {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const all: SongSeed[] = [];
  let artist = "";

  lines.forEach((line, i) => {
    if (ITEM_MARKER.test(line)) {
      const title = line.replace(ITEM_MARKER, "").trim();
      if (title) all.push({ title, artist });
      return;
    }
    const next = lines[i + 1];
    if (next !== undefined && ITEM_MARKER.test(next)) {
      artist = headerToArtist(line);
      return;
    }
    const split = line.match(/^(.+?)\s+[-–—]\s+(.+)$/);
    all.push(split ? { artist: split[1].trim(), title: split[2].trim() } : { title: line, artist: "" });
  });

  const seen = new Set<string>();
  const unique = all.filter((s) => {
    const key = `${s.artist}\u0000${s.title}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    songs: unique.slice(0, MAX_LIST_ITEMS),
    truncated: Math.max(0, unique.length - MAX_LIST_ITEMS),
  };
}

/** YouTube search string for a parsed song. */
export function searchQueryFor(song: SongSeed): string {
  return song.artist ? `${song.artist} ${song.title}` : song.title;
}

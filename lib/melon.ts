import type { ChartEntry } from "@/types/song";

// Melon has no public API, so we read the public realtime chart page.
// If Melon changes its markup, parseMelonChart returns [] and callers fall back.
const CHART_URL = "https://www.melon.com/chart/index.htm";
const SONG_URL = "https://www.melon.com/song/detail.htm?songId=";
const CACHE_TTL_MS = 10 * 60 * 1000;
const GENRE_CONCURRENCY = 6;

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  Referer: "https://www.melon.com/",
  "Accept-Language": "ko-KR,ko;q=0.9",
};

const globalForMelon = globalThis as unknown as {
  __melonChartCache?: { at: number; entries: ChartEntry[] };
  // A song's genre never changes, so this cache never expires.
  __melonGenreCache?: Map<string, string>;
};

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#039;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

function anchorTexts(fragment: string): string[] {
  return [...fragment.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/g)]
    .map((m) => decodeEntities(m[1].replace(/<[^>]+>/g, "")))
    .filter(Boolean);
}

export function parseMelonChart(html: string): ChartEntry[] {
  const rows = html.split(/<tr class="lst(?:50|100)"/).slice(1);
  const entries: ChartEntry[] = [];

  for (const row of rows) {
    const rank = Number(row.match(/<span class="rank\s*">(\d+)<\/span>/)?.[1]);
    const titleBlock = row.match(/<div class="ellipsis rank01">([\s\S]*?)<\/div>/)?.[1];
    const artistBlock = row.match(
      /<span class="checkEllipsis"[^>]*>([\s\S]*?)<\/span>/,
    )?.[1];
    if (!rank || !titleBlock || !artistBlock) continue;

    const title = anchorTexts(titleBlock)[0];
    const artist = anchorTexts(artistBlock).join(", ");
    if (!title || !artist) continue;

    // Album art URLs embed an upload timestamp (…/15082293_20261026170443_500.jpg)
    // that tracks the release date within about two weeks either way: art is
    // often uploaded shortly before release (With: art 10-26, release 11-03)
    // and re-uploads push it later. Close enough for a months-wide window.
    const d = row.match(/album\/images\/[^"]*?_(\d{4})(\d{2})(\d{2})\d*_500/);
    const songId = row.match(/data-song-no="(\d+)"/)?.[1];
    const entry: ChartEntry = { rank, title, artist };
    if (songId) entry.songId = songId;
    if (d) entry.releasedOn = `${d[1]}-${d[2]}-${d[3]}`;
    entries.push(entry);
  }

  return entries;
}

export async function fetchMelonChart(): Promise<ChartEntry[]> {
  const cached = globalForMelon.__melonChartCache;
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.entries;

  const res = await fetch(CHART_URL, {
    headers: HEADERS,
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Melon chart request failed: ${res.status}`);

  const entries = parseMelonChart(await res.text());
  if (entries.length === 0) throw new Error("Melon chart markup could not be parsed.");

  globalForMelon.__melonChartCache = { at: Date.now(), entries };
  return entries;
}

/** Read the official genre from a Melon song detail page (`<dt>장르</dt><dd>댄스</dd>`). */
export function parseSongGenre(html: string): string | undefined {
  const m = html.match(/<dt>장르<\/dt>\s*<dd>([\s\S]*?)<\/dd>/);
  const genre = m ? decodeEntities(m[1].replace(/<[^>]+>/g, "")) : "";
  return genre || undefined;
}

async function fetchSongGenre(songId: string): Promise<string | undefined> {
  const res = await fetch(SONG_URL + songId, {
    headers: HEADERS,
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return undefined;
  return parseSongGenre(await res.text());
}

/**
 * Attach the official genre to each entry. Genres are cached per song id
 * forever, so after the first search only songs new to the chart are fetched.
 * A failed lookup leaves `genre` undefined and is retried next time.
 */
export async function enrichWithGenres(entries: ChartEntry[]): Promise<ChartEntry[]> {
  const cache = (globalForMelon.__melonGenreCache ??= new Map());
  const missing = [
    ...new Set(entries.map((e) => e.songId).filter((id): id is string => !!id && !cache.has(id))),
  ];

  for (let i = 0; i < missing.length; i += GENRE_CONCURRENCY) {
    await Promise.all(
      missing.slice(i, i + GENRE_CONCURRENCY).map(async (id) => {
        const genre = await fetchSongGenre(id).catch(() => undefined);
        if (genre) cache.set(id, genre);
      }),
    );
  }

  return entries.map((e) => {
    const genre = e.songId ? cache.get(e.songId) : undefined;
    return genre ? { ...e, genre } : e;
  });
}

import type { ChartEntry } from "@/types/song";

// Melon has no public API, so we read the public realtime chart page.
// If Melon changes its markup, parseMelonChart returns [] and callers fall back.
const CHART_URL = "https://www.melon.com/chart/index.htm";
const CACHE_TTL_MS = 10 * 60 * 1000;

const globalForMelon = globalThis as unknown as {
  __melonChartCache?: { at: number; entries: ChartEntry[] };
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
    if (title && artist) entries.push({ rank, title, artist });
  }

  return entries;
}

export async function fetchMelonChart(): Promise<ChartEntry[]> {
  const cached = globalForMelon.__melonChartCache;
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.entries;

  const res = await fetch(CHART_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      Referer: "https://www.melon.com/",
      "Accept-Language": "ko-KR,ko;q=0.9",
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Melon chart request failed: ${res.status}`);

  const entries = parseMelonChart(await res.text());
  if (entries.length === 0) throw new Error("Melon chart markup could not be parsed.");

  globalForMelon.__melonChartCache = { at: Date.now(), entries };
  return entries;
}

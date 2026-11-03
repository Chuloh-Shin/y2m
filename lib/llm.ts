import { GoogleGenAI, Type } from "@google/genai";
import type { ChartEntry, SongSeed } from "@/types/song";

const MODEL = "gemini-2.5-flash";

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set. Add it to .env.local.");
  }
  return new GoogleGenAI({ apiKey });
}

/**
 * Extract a SongSeed[] from the model's text response.
 *
 * Google Search grounding is incompatible with JSON response schemas
 * ("Tool use with a response mime type 'application/json' is unsupported"),
 * so the model returns free-form text — usually a JSON array, sometimes
 * wrapped in a ```json code fence. This pulls the array out and validates it.
 */
export function parseSongSeeds(text: string): SongSeed[] {
  const stripped = text
    .replace(/```(?:json)?/gi, "")
    .replace(/```/g, "")
    .trim();

  // Grab the first [...] block so stray prose around it is ignored.
  const start = stripped.indexOf("[");
  const end = stripped.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("LLM response did not contain a JSON array.");
  }

  const parsed = JSON.parse(stripped.slice(start, end + 1)) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("LLM response was not a JSON array.");
  }

  return parsed
    .filter(
      (s): s is SongSeed =>
        !!s &&
        typeof s === "object" &&
        typeof (s as SongSeed).title === "string" &&
        typeof (s as SongSeed).artist === "string",
    )
    .map((s) => ({ title: s.title.trim(), artist: s.artist.trim() }))
    .filter((s) => s.title && s.artist);
}

/** How far back a song may have been released and still count as "최신". */
export const RECENT_MONTHS = 6;

export function isRecencyQuery(query: string): boolean {
  return /최신|신곡|요즘|최근|요새|newest|latest|new release/i.test(query);
}

/**
 * Drop chart songs released more than `months` before `now`.
 * Songs with an unknown release date are kept — we cannot prove they are old.
 */
export function filterRecent(
  chart: ChartEntry[],
  now: Date,
  months = RECENT_MONTHS,
): ChartEntry[] {
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - months);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return chart.filter((e) => !e.releasedOn || e.releasedOn >= cutoffStr);
}

/**
 * Most songs any one artist may contribute to a list. A fresh album puts
 * all its b-sides on the chart at once; without a cap one act fills the list.
 */
export const MAX_PER_ARTIST = 2;

/**
 * Map the ranks the model picked back onto real chart entries.
 * Unknown ranks and duplicates are dropped, so nothing outside the chart
 * can ever reach the user, and each artist is capped at `maxPerArtist`.
 */
export function pickChartEntries(
  ranks: unknown,
  chart: ChartEntry[],
  count: number,
  maxPerArtist = MAX_PER_ARTIST,
): SongSeed[] {
  if (!Array.isArray(ranks)) return [];
  const byRank = new Map(chart.map((e) => [e.rank, e]));
  const seen = new Set<number>();
  const perArtist = new Map<string, number>();
  const picked: SongSeed[] = [];
  for (const r of ranks) {
    const entry = typeof r === "number" ? byRank.get(r) : undefined;
    if (!entry || seen.has(entry.rank)) continue;
    seen.add(entry.rank);
    const artistKey = entry.artist.toLowerCase();
    const n = perArtist.get(artistKey) ?? 0;
    if (n >= maxPerArtist) continue;
    perArtist.set(artistKey, n + 1);
    picked.push({ title: entry.title, artist: entry.artist });
    if (picked.length === count) break;
  }
  return picked;
}

/** One chart line as shown to the model: "25. 꾼 — PLAVE [R&B/Soul, 2026-10]". */
export function formatChartLine(e: ChartEntry): string {
  const meta = [e.genre, e.releasedOn?.slice(0, 7)].filter(Boolean).join(", ");
  return `${e.rank}. ${e.title} — ${e.artist}${meta ? ` [${meta}]` : ""}`;
}

async function selectFromChart(
  ai: GoogleGenAI,
  query: string,
  count: number,
  chart: ChartEntry[],
): Promise<SongSeed[]> {
  const list = chart.map(formatChartLine).join("\n");
  const prompt = [
    "아래는 지금 이 순간의 멜론 실시간 차트입니다. 대괄호 안은 [멜론 공식 장르, 발매월]입니다.",
    list,
    "",
    `사용자 취향: "${query}"`,
    `위 차트에서 취향에 맞는 곡을 최대 ${count}개 골라, 잘 맞는 순서대로 순위 번호(rank) 배열로만 답하세요.`,
    "취향에 장르 조건(예: 댄스, 발라드, 힙합)이 있으면 대괄호 안의 공식 장르를 기준으로 엄격히 지키세요. 아티스트 이미지로 장르를 추측하지 마세요.",
    `한 아티스트의 곡은 최대 ${MAX_PER_ARTIST}곡까지만 고르세요.`,
    "분위기·대상(연령/성별 등) 조건도 지키고, 맞지 않는 곡은 개수를 채우려고 억지로 넣지 마세요.",
    "차트에 취향과 맞는 곡이 하나도 없으면 빈 배열 []을 반환하세요.",
  ].join("\n");

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: { type: Type.ARRAY, items: { type: Type.INTEGER } },
    },
  });

  const text = response.text;
  if (!text) return [];
  return pickChartEntries(JSON.parse(text), chart, count);
}

/**
 * Recommend songs for a taste query.
 *
 * With chart candidates: the model only chooses among them (hybrid mode),
 * which keeps results current and hallucination-free. The caller prepares
 * the candidates (recency filter, genre enrichment). If none match the taste
 * (e.g. "2000년대 힙합"), or none are given, fall back to
 * Google-Search-grounded free recommendation.
 */
export async function generateSongList(
  query: string,
  count: number,
  candidates?: ChartEntry[],
): Promise<SongSeed[]> {
  const ai = getClient();

  if (candidates && candidates.length > 0) {
    const picked = await selectFromChart(ai, query, count, candidates);
    if (picked.length > 0) return picked;
  }

  return recommendWithSearch(ai, query, count);
}

async function recommendWithSearch(
  ai: GoogleGenAI,
  query: string,
  count: number,
): Promise<SongSeed[]> {
  const today = new Date().toISOString().slice(0, 10);

  const prompt = [
    `오늘 날짜는 ${today}입니다.`,
    `사용자 취향: "${query}"`,
    `위 취향에 맞는 실제로 존재하는 곡 ${count}개를 추천해주세요.`,
    "'최신', '요즘', '신곡' 같은 표현이 있으면 Google 검색으로 최근 1~2년 내 발매곡을 우선 찾으세요.",
    "오래된 유명곡으로 기본값을 때우지 말고, 취향의 시의성을 반영하세요.",
    "환각된 가짜 곡은 절대 포함하지 마세요. 실제 발매된 곡만 추천합니다.",
    "중복 없이 다양하게.",
    '응답은 코드블록 없이 JSON 배열만 출력하세요. 각 원소는 {"title": 곡명, "artist": 아티스트} 형식입니다.',
  ].join("\n");

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      // Grounding lets the model reach beyond its training cutoff for
      // genuinely recent releases. Note: tools cannot be combined with a
      // JSON response schema, so we parse the text ourselves.
      tools: [{ googleSearch: {} }],
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("LLM returned an empty response.");
  }

  return parseSongSeeds(text).slice(0, count);
}

import { GoogleGenAI } from "@google/genai";
import type { SongSeed } from "@/types/song";

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

export async function generateSongList(
  query: string,
  count: number,
): Promise<SongSeed[]> {
  const ai = getClient();
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

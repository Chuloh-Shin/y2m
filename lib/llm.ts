import { GoogleGenAI, Type } from "@google/genai";
import type { SongSeed } from "@/types/song";

const MODEL = "gemini-2.5-flash";

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set. Add it to .env.local.");
  }
  return new GoogleGenAI({ apiKey });
}

export async function generateSongList(
  query: string,
  count: number,
): Promise<SongSeed[]> {
  const ai = getClient();

  const prompt = [
    `사용자 취향: "${query}"`,
    `위 취향에 맞는 실제로 존재하는 곡 ${count}개를 추천해주세요.`,
    "각 곡은 title(곡명)과 artist(아티스트)를 가집니다.",
    "환각된 가짜 곡은 절대 포함하지 마세요. 실제 발매된 곡만 추천합니다.",
    "중복 없이 다양하게.",
  ].join("\n");

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            artist: { type: Type.STRING },
          },
          required: ["title", "artist"],
        },
      },
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("LLM returned an empty response.");
  }

  const parsed = JSON.parse(text) as SongSeed[];
  return parsed.slice(0, count);
}

/**
 * M1 probe: Gemini가 만든 곡 리스트가 YouTube에서 정확히 매칭되는 비율을 측정.
 *
 * 실행:  bun run scripts/probe.ts
 * 결과:  콘솔에 50건 출력. 사용자가 직접 매칭을 확인하고
 *        artifacts/mp3-curator/evidence/probe.md에 정확도를 기록.
 *
 * 합격 기준: 매칭 정확도 ≥ 70%.
 */
import { generateSongList } from "@/lib/llm";
import { searchTopMatch } from "@/lib/youtube";

const QUERIES = [
  "여성 20대가 좋아하는 최신 K-pop 댄스곡",
  "출퇴근용 잔잔한 한국 발라드",
  "운동할 때 듣기 좋은 에너지 넘치는 EDM",
  "공부할 때 듣기 좋은 lofi hip hop",
  "2010년대 인기 영화 OST",
];
const SONGS_PER_QUERY = 10;

async function main() {
  console.log("=== M1 probe — Gemini × YouTube 매칭 정확도 검증 ===\n");

  let totalRows = 0;
  for (const query of QUERIES) {
    console.log(`\n## Query: ${query}\n`);
    const seeds = await generateSongList(query, SONGS_PER_QUERY);
    let idx = 0;
    for (const seed of seeds) {
      idx += 1;
      totalRows += 1;
      const searchKey = `${seed.artist} ${seed.title}`;
      try {
        const match = await searchTopMatch(searchKey);
        if (!match) {
          console.log(
            `  ${idx}. ${seed.artist} — ${seed.title}\n     → NO MATCH`,
          );
        } else {
          console.log(
            `  ${idx}. ${seed.artist} — ${seed.title}\n` +
              `     → ${match.title}\n` +
              `     → ${match.url}`,
          );
        }
      } catch (err) {
        console.log(
          `  ${idx}. ${seed.artist} — ${seed.title}\n     → ERROR: ${(err as Error).message}`,
        );
      }
    }
  }

  console.log(
    `\n=== 출력 끝. 총 ${totalRows}건. 사용자가 직접 확인해 ` +
      `artifacts/mp3-curator/evidence/probe.md에 정확도를 기록하세요. ===\n`,
  );
}

main().catch((err) => {
  console.error("probe failed:", err);
  process.exit(1);
});

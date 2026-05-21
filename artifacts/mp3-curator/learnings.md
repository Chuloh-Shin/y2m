# mp3-curator learnings

---
category: tooling
applied: not-yet
---
## youtube-search-api가 batch 호출에서 무너짐

**상황**: Task 1 (M1 probe) 실행 중 발견. 5 쿼리 × 10곡 × YouTube 검색 = 50건을 연속 호출하니, 각 쿼리의 첫 3-4건만 성공하고 나머지 모두 `INIT_DATA_ERROR: Maximum number of redirects exceeded`로 실패. 50건 중 12건만 성공. plan.md에서 "비공식 라이브러리 (추천)"로 선택했는데, 그 카테고리에서 라이브러리 선택이 실패. 단일 호출엔 잘 작동하지만 연속 호출에서 internal session 상태가 누적되는 것으로 보임.

**판단**: 라이브러리 교체. 같은 카테고리(비공식 라이브러리)에서 더 활발하게 유지되는 `youtubei.js`(InnerTube wrapper) 시도 권장. 만약 그것도 실패하면 yt-dlp 검색(`ytsearch1:`)으로 통합하거나 YouTube Data API v3 키 등록으로 분류 자체 변경. **결정은 사용자 컨펌 후 실행.**

**다시 마주칠 가능성**: 높음 — 비공식 YouTube 라이브러리는 YouTube 측 클라이언트 차단 변화에 자주 깨진다. 다음 feature에서 같은 카테고리를 고를 때는 단발 sample 호출이 아니라 batch 호출로 안정성을 먼저 검증해야 함.

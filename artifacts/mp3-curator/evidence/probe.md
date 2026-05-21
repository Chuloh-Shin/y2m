# M1 probe 결과

## 실행 정보

- 실행일: 2026-05-21
- 모델: `gemini-2.5-flash`
- LLM SDK: `@google/genai@2.5.0`
- YouTube 검색: `youtubei.js@17.0.1` (이전 `youtube-search-api`는 batch 호출에서 무너져 교체. learnings.md 참조)
- 쿼리 수: 5개 / 쿼리당 10곡 / 총 50건

## 카테고리별 정확도

| Query | 정확 / 10 |
|---|---|
| 여성 20대가 좋아하는 최신 K-pop 댄스곡 | 10 |
| 출퇴근용 잔잔한 한국 발라드 | 10 |
| 운동할 때 듣기 좋은 에너지 넘치는 EDM | 10 |
| 공부할 때 듣기 좋은 lofi hip hop | **4** |
| 2010년대 인기 영화 OST | 10 |

## 정확도 산출

| 항목 | 값 |
|---|---|
| 매칭 성공 (의도한 곡) | 44 / 50 |
| 매칭 실패 (다른 곡 / 무관 영상) | 6 / 50 |
| **정확도** | **88%** |
| 환각 곡 (존재하지 않는 곡명) | 0 / 50 |

## 합격 기준

- ✅ **정확도 ≥ 70% → Task 2 진행**
- ❌ 정확도 < 70% → plan 재조정

## 결과

**합격.** 88%로 70% 기준 통과. plan을 그대로 진행한다.

## 매칭 실패 패턴

전부 lofi hip hop 카테고리. 공통점:
- 마이너 인디 아티스트의 짧은 트랙
- YouTube에 공식 채널이 없거나 비활성 → 검색 상위가 무관 영상으로 채워짐
- 곡명 자체가 일반 단어(`Snowman`, `Days Gone`, `Thinking Of You`)라 검색에 노이즈

구체 사례:
- `Chloe Moriondo — Snowman` → `buttercup cover` (다른 곡)
- `Elijah Who — First Snow` → `Elijah's First Snow Adventure` (브이로그)
- `L'indécis — Days Gone` → `Days Gone in 2023` (게임 비디오)
- `Idealism — Thinking Of You.` → `Idealism According to Chomsky` (철학 강의)
- `Raimu — Maple` → `Raimu & Tenno - Nightingale` (다른 트랙)
- `potsu — I'm sorry` → `i'm closing my eyes` (다른 곡)

## 환각 사례

없음. Gemini가 실제 존재하는 곡명만 생성.

## 결론 — 다음 단계에 미치는 영향

- 메인스트림 취향(K-pop·발라드·EDM·인기 OST)에서는 거의 완벽(100%) → spec의 wireframe 그대로 진행
- 마이너 인디(lofi·언더그라운드 일렉트로닉 등)에서는 정확도 큰 폭 하락 → 사용자가 곡 목록 확인 화면의 **체크박스로 잘못된 매칭을 빼는 흐름**이 실질적 painkiller가 됨. spec의 1-a 시나리오가 결과적으로 핵심임이 다시 확인
- **plan을 변경하지 않는다.** Task 2부터 그대로 진행.

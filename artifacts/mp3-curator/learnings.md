# mp3-curator learnings

---
category: tooling
applied: not-yet
---
## Windows path를 `.env.local`에 넣을 때 backslash가 잘림

**상황**: Task 2 검증 중. 사용자가 `.env.local`에 `FFMPEG_PATH=C:\...\bin\ffmpeg.exe`를 넣었더니 process.env에서 `ffmpeg.e`로 잘려서 들어옴. 끝의 `\xe`가 escape 시퀀스로 처리된 것으로 보임. dotenv 호환 파서가 unquoted 값을 그대로 전달하지 않고 일부 escape를 해석.

**판단**: 사용자 안내를 forward slash 표기로 통일. Windows에서도 forward slash가 Node spawn에 잘 동작. 또는 큰따옴표로 감싸고 `\\` 이중 backslash로 작성. 우리 코드는 변경 없음 — env value를 그대로 받아 spawn.

**다시 마주칠 가능성**: 높음 — Windows 환경에서 외부 바이너리·시스템 경로를 env에 넣는 모든 future feature가 같은 함정에 빠짐. 가이드라인: "Windows path는 forward slash로 적거나, `~/AppData/...`처럼 process.env.HOME/USERPROFILE 기반으로 코드에서 조립한다."

---
category: refactor
applied: not-yet
---
## Next.js dev에서 in-memory store는 `globalThis`로 pin

**상황**: Task 2 검증 중. `lib/jobs.ts`의 `Map`을 module-local로 두니, server action(`startUrlConversion`)이 만든 job을 route handler(`/api/download/...`)가 못 찾고 404 반환. Next.js dev의 HMR/모듈 재로딩 경계에서 module instance가 갈렸기 때문.

**판단**: `globalThis.__mp3JobsStore`로 store를 pin. 같은 process 안의 어느 모듈 인스턴스도 같은 Map을 공유. production에서도 단일 process 안에서는 의도대로 동작. 단일 사용자 (본인용) 가정에서 충분.

**다시 마주칠 가능성**: 높음 — Next.js dev에서 server action·route handler·middleware를 거쳐 모듈 상태를 공유하려는 모든 시도에 같은 문제 발생. 가이드라인: "Server-side in-memory store는 처음부터 globalThis에 pin한다."

---
category: tooling
applied: not-yet
---
## youtube-search-api가 batch 호출에서 무너짐

**상황**: Task 1 (M1 probe) 실행 중 발견. 5 쿼리 × 10곡 × YouTube 검색 = 50건을 연속 호출하니, 각 쿼리의 첫 3-4건만 성공하고 나머지 모두 `INIT_DATA_ERROR: Maximum number of redirects exceeded`로 실패. 50건 중 12건만 성공. plan.md에서 "비공식 라이브러리 (추천)"로 선택했는데, 그 카테고리에서 라이브러리 선택이 실패. 단일 호출엔 잘 작동하지만 연속 호출에서 internal session 상태가 누적되는 것으로 보임.

**판단**: 라이브러리 교체. 같은 카테고리(비공식 라이브러리)에서 더 활발하게 유지되는 `youtubei.js`(InnerTube wrapper) 시도 권장. 만약 그것도 실패하면 yt-dlp 검색(`ytsearch1:`)으로 통합하거나 YouTube Data API v3 키 등록으로 분류 자체 변경. **결정은 사용자 컨펌 후 실행.**

**다시 마주칠 가능성**: 높음 — 비공식 YouTube 라이브러리는 YouTube 측 클라이언트 차단 변화에 자주 깨진다. 다음 feature에서 같은 카테고리를 고를 때는 단발 sample 호출이 아니라 batch 호출로 안정성을 먼저 검증해야 함.

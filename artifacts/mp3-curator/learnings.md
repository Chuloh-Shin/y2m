# mp3-curator learnings

---
category: code-review
applied: rule
---
## "다시 생성" 후 자식 state가 새 props에 동기화되지 않음

**상황**: code-reviewer가 짚음. `ListConfirmScreen`이 `checkedMask.length !== songs.length`로만 리셋 판정 → 같은 N으로 재생성 시 이전 unchecked 인덱스가 새 곡에 그대로 매핑되는 spec 위반 버그. 테스트는 onRegenerate 콜백만 확인했고 props 교체 후 state 검증이 없어서 가려져 있었음.

**판단**: songs prop의 **identity**(reference)를 별도 state로 추적해 새 reference면 mask 리셋. render-phase setState로 React 18 안전 패턴 적용. 회귀 방지 테스트로 "songs prop 교체 후 모두 다시 체크됨" 케이스 추가.

**다시 마주칠 가능성**: 높음 — "같은 모양의 새 데이터로 자식 컴포넌트 reset" 패턴은 future feature에서 흔히 마주침. **rule로 즉시 승격** → `.claude/rules/derived-state-reset.md`로 패턴 명문화 고려.

---
category: code-review
applied: not-yet
---
## Dev 서버 종료 시 in-memory store의 stale active job lock

**상황**: code-reviewer가 짚음. `globalThis`로 pin한 jobs store가 HMR을 살아남는 건 의도대로지만, dev 서버 Ctrl+C로 변환 도중 종료 시 non-terminal items가 남아 다음 시작 때 `hasActiveJob() === true`로 영구 lock. 사용자가 어떤 제출도 못 함.

**판단**: 모듈 첫 로드 시 활성 job의 non-terminal items를 `failed`(사유: "서버 재시작으로 변환이 중단됨")로 sweep + activeJobId 해제. 모듈 import 시 한 번만 실행되므로 cost 없음.

**다시 마주칠 가능성**: 중간 — in-memory store + long-running 작업 조합이 다른 feature에서도 발생 가능. 일반화는 약함 (store 종류마다 cleanup 로직이 다름).

---
category: code-review
applied: not-yet
---
## `Promise` 기반 fire-and-forget의 클라이언트 UX 깜빡임

**상황**: code-reviewer가 짚음. `setMode({kind:"progress",...})` 직후 첫 `getJobStatus` 응답 전까지 `mode.kind === "progress" && job` 조건이 false라 InputScreen이 다시 렌더됨. 빠른 사용자가 버튼을 두 번 누를 수 있는 UX 깜빡임 (서버측 가드는 있음).

**판단**: 명시적 "시작 중…" loading 상태를 분리. mode가 progress인데 job이 null인 경우의 별도 컴포넌트.

**다시 마주칠 가능성**: 높음 — 모든 state machine + async first-fetch 조합에서 동일 패턴. 가이드라인: "비동기 데이터 의존 상태 전환은 'loading' 단계를 명시적으로 두자."

---
category: code-review
applied: discarded
---
## stdout 마지막 줄 의존을 절대경로 탐색으로 강건화

**상황**: code-reviewer가 짚음. `lib/converter.ts`가 yt-dlp의 `--print after_move:filepath` stdout의 마지막 줄을 filepath로 가정. 추가 출력이나 곡명에 개행이 들어가는 예외 케이스에서 깨질 가능성.

**판단**: 마지막 줄 대신 stdout 라인 중 절대경로처럼 생긴 것 중 가장 나중 줄을 골라 강건성 ↑. 일반화하면 "subprocess 출력 파싱은 위치가 아닌 형식으로 골라낸다"로 묶일 수 있으나, 현재 한 케이스로 rule 승격은 약함. 일회성 강건화로 분류.

**다시 마주칠 가능성**: 낮음 — yt-dlp 외 subprocess wrapper를 또 작성하지 않으면 재발 X.

**후속 결과**: 위 "절대경로 탐색"도 부족했음. 한 step 뒤 항목 참조.

---
category: tooling
applied: not-yet
---
## Subprocess stdout 파싱 자체를 피하고 결과물 파일을 directory listing으로 찾기

**상황**: 사용자가 BLACKPINK 곡 변환 시도 → `ENOENT: copyfile 'C:\Users\admin\AppData\Local\Temp\m'`로 실패. Windows + 한글 곡명 조합에서 yt-dlp stdout 인코딩이 깨져, 우리가 "절대 경로처럼 생긴" 잘린 문자열(`C:\...\Temp\m`)을 picked 해버린 게 원인. 직전 항목의 reviewer-suggested 강건화도 이 케이스를 못 막았음.

**판단**: Stdout 파싱 자체를 버림. `convertToMp3`가 자기가 만든 jobDir을 알고 있으므로 `readdir(jobDir)`로 직접 `.mp3` 파일을 찾도록 변경. yt-dlp가 intermediate webm을 정리한 뒤라 폴더에 mp3 하나만 남고, 어떤 인코딩 환경에서도 결과가 같다. **이전 "discarded"로 분류한 학습을 뒤집어, 일반화 명시:**

> **Subprocess의 결과물을 stdout 파싱으로 잡지 말고, 그 subprocess가 쓴 파일·디렉토리를 직접 listing하라.** stdout은 인코딩·로케일·버퍼링·언어 변화에 약한 채널이고, 결과물의 파일시스템 위치는 우리가 제어하는 input(인수로 넘긴 경로)에서 파생되므로 안전하다.

**다시 마주칠 가능성**: 높음 — 외부 CLI(ffmpeg, pandoc, sox, sed/awk pipeline 결과물 등)를 subprocess로 부르는 모든 future feature에 적용 가능. compound 분석에서 rule 승격 후보로 강하게 추천.

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

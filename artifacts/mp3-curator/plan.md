# MP3 Curator 구현 계획

## 아키텍처 결정

| 결정 | 선택 | 이유 |
|---|---|---|
| LLM | Google Gemini | 사용자 선택. 비용·품질 균형. `GEMINI_API_KEY` env var로 호출 |
| LLM SDK | `@google/genai` | Google 공식 SDK |
| YouTube 검색 | `youtube-search-api` (비공식) | 본인용·로컬 실행 한정. API 할당량 없음. spec에서 허용 |
| 오디오 추출·변환 | `yt-dlp` + `ffmpeg` subprocess | idea.md에서 결정. Windows에서 `yt-dlp.exe`·`ffmpeg.exe` 사용 |
| 진행 상태 통신 | 폴링 (클라이언트가 1초 간격으로 `getJobStatus` Server Action 호출) | 본인용 minimal. SSE보다 단순. Job은 서버 메모리에서만 생존 |
| 화면 전환 | 단일 라우트(`app/page.tsx`)에서 client state로 입력/목록/진행 전환 | wireframe과 일치. 새로고침 = 초기화(불변 규칙)와도 자연스럽게 맞음 |
| 다운로드 전달 | 서버가 mp3 변환 후 클라이언트가 `<a href download>`로 가져옴 | 브라우저의 기본 다운로드 폴더에 자동 저장(불변 규칙) |
| 동시성 제한 | 서버 메모리에 활성 Job ID 1개만 허용. 두 번째 요청은 409 응답 | 본인용·동시 1요청만 |
| 컴포넌트 시각 | wireframe의 컴포넌트 매핑: Card / Field+Input / Checkbox / Button / Alert / Progress / Spinner / sonner Toaster | wireframe.html에서 식별된 시각 요소를 shadcn 기본 컴포넌트로 1:1 매핑 |

## 인프라 리소스

| 리소스 | 유형 | 선언 위치 | 생성 Task |
|---|---|---|---|
| `GEMINI_API_KEY` | Env var | `.env.local` (gitignore) | Task 1 |
| `yt-dlp.exe` | 외부 바이너리 | 시스템 PATH 또는 프로젝트 `bin/` 디렉토리 | Task 2 |
| `ffmpeg.exe` | 외부 바이너리 | 시스템 PATH 또는 프로젝트 `bin/` 디렉토리 | Task 2 |
| Job memory store | In-memory Map (Node 프로세스 수명) | `lib/jobs.ts` | Task 2 |

## 데이터 모델

서버 메모리에만 존재. DB 없음.

### Song
- `title` (required)
- `artist` (취향 모드에서 채움. URL 모드에서는 빈 문자열 가능)
- `youtubeUrl` (required — 검색 결과 또는 사용자 입력)
- `thumbnailUrl` (취향 모드에서 채움)

### SongJobItem (Song 확장)
- 모든 `Song` 필드
- `selected: boolean` — 곡 목록 확인 화면 체크박스 상태 (URL 모드는 항상 true)
- `status: "pending" | "searching" | "downloading" | "converting" | "done" | "failed"`
- `failureReason?: string`
- `downloadUrl?: string` — 변환 완료 시 클라이언트가 가져갈 mp3 경로

### Job
- `id: string` (서버 메모리 키)
- `mode: "url" | "playlist"`
- `items: SongJobItem[]`
- `createdAt: number`

## 필요 스킬

| 스킬 | 적용 Task | 용도 |
|---|---|---|
| shadcn | Task 2, 3, 4 | Card · Field · Input · Checkbox · Button · Alert · Progress · Spinner · sonner. `components.json` 따라 컴포넌트 추가 전 `npx shadcn@latest info` 먼저 확인 |
| next-best-practices | Task 2, 3, 4 | Server Actions, `"use client"` 경계, async params/searchParams, App Router 파일 conventions |
| vercel-react-best-practices | Task 3, 4 | 상태 분리(체크박스 토글이 전체 리스트 재렌더 안 하도록), Server Component default |
| vercel-composition-patterns | Task 3, 4 | 입력/목록/진행 세 화면의 합성 (한 라우트 안의 state-driven view switching) |
| web-design-guidelines | Task 2, 3, 4 마무리 | UI 리뷰 — 각 Task 끝에서 가독성·계층·접근성 점검 |

## 영향 받는 파일

| 파일 경로 | 변경 유형 | 관련 Task |
|---|---|---|
| `scripts/probe.ts` | New | Task 1 |
| `artifacts/mp3-curator/evidence/probe.md` | New | Task 1 |
| `.env.local.example` | New (gitignored `.env.local` 안내) | Task 1 |
| `types/song.ts` | New | Task 1 (확장) → Task 2 |
| `lib/llm.ts` | New | Task 1, 3 |
| `lib/youtube.ts` | New | Task 1, 3, 4 |
| `lib/converter.ts` | New | Task 2 |
| `lib/jobs.ts` | New | Task 2 |
| `app/actions.ts` | New | Task 2, 3, 4 |
| `app/layout.tsx` | Modify (`metadata.title` 교체, sonner Toaster 추가) | Task 2 |
| `app/page.tsx` | Modify (ComponentExample → InputScreen state machine) | Task 2 |
| `components/curator/InputScreen.tsx` | New | Task 2 → Task 3 확장 |
| `components/curator/InputScreen.test.tsx` | New | Task 2, 3 |
| `components/curator/ListConfirmScreen.tsx` | New | Task 3 |
| `components/curator/ListConfirmScreen.test.tsx` | New | Task 3 |
| `components/curator/SongListItem.tsx` | New | Task 3 |
| `components/curator/ProgressScreen.tsx` | New | Task 2 → Task 4 확장 |
| `components/curator/ProgressScreen.test.tsx` | New | Task 2, 4 |
| `components/curator/SongProgressCard.tsx` | New | Task 2, 4 |
| `e2e/curator.spec.ts` | New | Task 2, 4 |

## Tasks

### Task 1: M1 probe — Gemini 곡 리스트 + YouTube 매칭 정확도 사전 검증

- **담당 시나리오**: 시나리오 외 사전 검증 (idea.md의 M1·M3 가정). 결과가 plan 전체의 전제.
- **크기**: S (2-3 파일)
- **의존성**: None
- **참조**:
  - `artifacts/mp3-curator/idea.md` (Key Assumptions M1·M3)
  - `@google/genai` 공식 문서
  - `youtube-search-api` npm 페이지
- **구현 대상**:
  - `lib/llm.ts` — Gemini 호출 wrapper (`generateSongList(query: string, count: number): Promise<Song[]>`)
  - `lib/youtube.ts` — `youtube-search-api` wrapper (`searchTopMatch(query: string): Promise<{ url, thumbnail }>`)
  - `scripts/probe.ts` — 5개 취향 쿼리 × 10곡 LLM 생성 × YouTube 검색 = 50건 출력
  - `.env.local.example` — `GEMINI_API_KEY=<your-key>` 한 줄
  - `types/song.ts` — `Song` 타입 (이 시점에는 `title`, `artist`, `youtubeUrl`, `thumbnailUrl`)
- **수용 기준**:
  - [x] 5개 취향 쿼리(예: "여성 20대 댄스곡", "출퇴근용 잔잔한 발라드" 등)에 대해 Gemini가 각 10곡의 `{title, artist}` 리스트를 반환한다
  - [x] 각 곡명+아티스트로 YouTube 검색한 상위 1개 결과의 `url`·`thumbnail`이 비어 있지 않은 값으로 추출된다
  - [x] 사람이 50건의 매칭 결과를 직접 URL로 확인하고 정확도(올바른 영상이 매칭된 비율)를 산출한다 — **88% (44/50)**
  - [x] 환각 곡(존재하지 않는 곡명) 비율과 매칭 실패 사례가 `artifacts/mp3-curator/evidence/probe.md`에 기록된다 — 환각 0건, 실패는 lofi 카테고리에 집중
  - [x] 정확도가 ≥70%이면 Task 2로 진행. — **합격, Task 2 진행**
- **검증**:
  - `bun run scripts/probe.ts` 실행 후 콘솔 출력 50줄
  - Human review — 리뷰어: 사용자 본인, 산출물: `artifacts/mp3-curator/evidence/probe.md`, 기준: 매칭 정확도 ≥ 70%

---

### Checkpoint: Task 1 이후
- [ ] `artifacts/mp3-curator/evidence/probe.md`에 50건 매칭 결과와 정확도가 기록됨
- [ ] 정확도 ≥ 70% 확인. 미만이면 사용자와 plan 재조정 회의
- [ ] `lib/llm.ts`, `lib/youtube.ts`의 핵심 함수가 호출 가능

---

### Task 2: URL 모드 — 단일 영상 mp3 변환 end-to-end

- **담당 시나리오**: 시나리오 2 (URL 모드 happy path) + 불변 규칙 §새로고침 동작·§동시 실행 제한 (진행 화면이 처음 생기는 Task — fail-fast로 여기서 검증)
- **크기**: M (5 파일)
- **의존성**: Task 1 (`types/song.ts` 정의 시점만 — `llm.ts`·`youtube.ts`는 Task 3에서 사용)
- **참조**:
  - shadcn — `Card`, `Field`, `Input`, `Button`, `Spinner`, `sonner` (Toaster). 추가 전 `npx shadcn@latest info`로 설치 여부 확인 → 없는 것만 `add`
  - next-best-practices — Server Action, `"use client"` 경계
  - yt-dlp man page (오디오 추출 옵션 `-x --audio-format mp3`)
- **구현 대상**:
  - `lib/converter.ts` — yt-dlp + ffmpeg subprocess (`convertToMp3(url: string, onProgress): Promise<{ filePath }>`)
  - `lib/jobs.ts` — In-memory Job store (`createJob`, `getJob`, `updateItem`, 동시성 가드)
  - `app/actions.ts` — `startUrlConversion(url)`, `getJobStatus(jobId)`, `downloadFile(jobId, itemIndex)`
  - `app/layout.tsx` — `metadata.title`을 `"MP3 Curator"`로 교체, `<Toaster />` 추가
  - `app/page.tsx` — `ComponentExample` 제거. 상위 state machine으로 `<InputScreen>` / `<ProgressScreen>` 전환
  - `components/curator/InputScreen.tsx` — 취향 영역은 placeholder(다음 Task), URL 영역만 동작
  - `components/curator/ProgressScreen.tsx` — `<SongProgressCard>` 리스트 + 종결 후 "새 입력으로" 버튼
  - `components/curator/SongProgressCard.tsx` — 곡명·아티스트·상태 아이콘 표시
  - `components/curator/InputScreen.test.tsx` · `ProgressScreen.test.tsx` (Vitest, `@testing-library/react`)
  - `e2e/curator.spec.ts` — URL 모드 happy path (yt-dlp 호출은 짧은 영상으로 실제 실행)
- **수용 기준** (시나리오 2 성공 기준 + 불변 규칙 §새로고침·§동시 실행 제한 파생):
  - [x] 입력 화면 하단에 "YouTube 영상 URL" 라벨이 붙은 입력란과 "변환" 버튼이 보인다
  - [x] 유효한 URL을 입력하고 "변환"을 클릭하면 진행 화면으로 전환된다
  - [x] 진행 화면에 카드가 정확히 1개 표시된다
  - [x] 카드의 상태 텍스트가 시간 경과에 따라 "완료" 또는 "실패"로 이동한다
  - [x] "완료" 상태일 때 클라이언트의 기본 다운로드 폴더에 mp3 1개가 저장된다 — `Me at the zoo.mp3` (331KB) 확인
  - [x] 모든 카드가 종결되기 전까지 "새 입력으로" 버튼은 비활성 상태로 보인다
  - [x] 진행 화면 상태에서 페이지 새로고침 시 입력 화면(초기 상태)으로 복귀하고, 진행 중이던 카드 목록은 복구되지 않는다 (불변 규칙 §새로고침)
  - [x] 변환 진행 중에는 입력 화면의 모든 제출 버튼이 비활성 상태로 보인다 (불변 규칙 §동시 실행 제한, URL 모드 시점에서 첫 검증)
- **검증**:
  - Vitest: `bun run test -- InputScreen ProgressScreen` (입력 → 진행 화면 전환, 종결 시 버튼 활성)
  - Build: `bun run build`
  - Playwright: `bun run test:e2e -- curator` (한 곡 실제 변환. 짧은 CC0 영상 URL 사용)
  - Browser MCP — `mcp__claude-in-chrome__navigate`로 `/`로 이동 → URL 입력 → 변환 → 다운로드 폴더에 mp3 생성 확인. 증거 `artifacts/mp3-curator/evidence/task-2-screenshot.png`

---

### Checkpoint: Task 2 이후
- [ ] `bun run test` 통과
- [ ] `bun run build` 성공
- [ ] URL 한 개를 mp3로 받는 end-to-end가 실제 브라우저에서 동작

---

### Task 3: 취향 모드 — 입력부터 곡 목록 확인 화면까지

- **담당 시나리오**: 시나리오 1 (전반부 — 곡 목록 화면 도달까지), 시나리오 3 (다시 생성), 시나리오 4 (입력 수정), 시나리오 6 (입력 검증), 시나리오 7 (LLM 호출 실패)
- **크기**: M (5 파일 + 기존 InputScreen·types 확장)
- **의존성**: Task 1 (`lib/llm.ts`, `lib/youtube.ts`), Task 2 (`InputScreen`, state machine)
- **참조**:
  - shadcn — `Checkbox`, `Alert`, `Field` validation 패턴 (`data-invalid` + `aria-invalid`), `InputGroup`
  - vercel-composition-patterns — 같은 라우트 내 view switching
- **구현 대상**:
  - `types/song.ts` — `SongJobItem`에 `selected`, `status`, `thumbnailUrl` 등 추가
  - `app/actions.ts` — `generateSongList(query, count): Promise<Song[]>` 추가. 동일 입력 재호출(다시 생성)을 위해 캐시 안 함
  - `components/curator/InputScreen.tsx` — 취향 영역 채우기: 텍스트박스, 곡 수 input(1-50), "곡 목록 만들기" 버튼, 검증(빈 입력 → 버튼 비활성), LLM 실패 시 Alert 표시 + 입력값 보존
  - `components/curator/ListConfirmScreen.tsx` — 항목 N개 렌더, 카운트 헤더, "다운로드 시작 (N곡)" / "다시 생성" / "입력 수정" 액션
  - `components/curator/SongListItem.tsx` — 체크박스 + 썸네일 `<img>` + 곡명·아티스트 + "미리 듣기" 외부 링크
  - `components/curator/ListConfirmScreen.test.tsx` (Vitest)
  - `app/page.tsx` — state machine에 `"list"` 단계 추가, 입력값 보존 로직
- **수용 기준** (시나리오 1·3·4·6·7의 성공 기준 + 불변 규칙 §동시 실행 제한 파생):
  - [x] 입력 화면 상단에 취향 텍스트박스와 곡 수 input(기본값 10)이 보인다
  - [x] 취향이 비어 있을 때 "곡 목록 만들기" 버튼이 비활성 상태로 보인다
  - [x] 곡 수에 0 또는 51을 입력하면 값이 1·50으로 클램프되거나 제출이 막힌다
  - [x] 유효 입력 + "곡 목록 만들기" 클릭 → 곡 목록 확인 화면 전환 + N개 항목 표시
  - [x] 각 항목에 비어 있지 않은 곡명·아티스트·썸네일 이미지·외부 YouTube URL이 표시된다
  - [x] 각 항목의 체크박스가 초기에 체크된 상태다
  - [x] "미리 듣기" 링크 클릭 → 새 탭에서 해당 영상이 열린다 (`target="_blank"`, `rel="noopener"`)
  - [x] 체크박스 토글 → 헤더의 "N곡 중 M곡 선택됨" 카운트와 "다운로드 시작 (M곡)" 라벨이 실시간 갱신
  - [x] 체크 해제된 항목은 시각적으로 흐리게 표시되고 곡명에 취소선이 들어간다 (wireframe screen-3과 일치)
  - [x] 모든 항목 체크 해제 → "다운로드 시작" 버튼이 비활성 상태로 보인다
  - [x] "다시 생성" 클릭 → 새 항목 목록이 표시되고, 최소 한 곡 이상 직전 목록과 다르다
  - [x] "입력 수정" 클릭 → 입력 화면 복귀 + 취향 텍스트·곡 수가 직전 입력값으로 채워져 있다
  - [x] LLM 호출 실패 시 입력 화면을 유지한 채 비어 있지 않은 에러 메시지 Alert이 표시되고 입력값은 보존된다
  - [x] LLM 호출 실패 후 "곡 목록 만들기" 버튼의 라벨이 "다시 시도"로 표시된다 (wireframe screen-7)
  - [x] 곡 목록 생성 호출이 진행 중인 동안에는 취향의 "곡 목록 만들기"와 URL의 "변환" 버튼이 모두 비활성 상태로 보인다 (불변 규칙 §동시 실행 제한)
- **검증**:
  - Vitest: `bun run test -- InputScreen ListConfirmScreen` (각 수용 기준에 1:1 매핑되는 테스트)
  - Vitest의 LLM/YouTube 호출은 `vi.mock`으로 `lib/llm.ts`·`lib/youtube.ts`만 mock(원본 SDK는 mock 안 함 — 우리 코드의 경계가 mock 경계)
  - Build: `bun run build`
  - Browser MCP — 실제 Gemini 호출로 한 사이클(입력 → 목록 → 다시 생성 → 입력 수정). 증거 `artifacts/mp3-curator/evidence/task-3-screenshot.png`

---

### Checkpoint: Task 3 이후
- [ ] `bun run test` 통과 (Task 2 + Task 3 모든 테스트)
- [ ] `bun run build` 성공
- [ ] 실제 Gemini 호출로 곡 목록 확인 화면까지 동작
- [ ] 입력 수정 → 값 보존 / 다시 생성 → 목록 갱신 / LLM 실패 시 에러 표시가 실제 브라우저에서 동작

---

### Task 4: 취향 모드 — 일괄 다운로드 진행 (체크박스 제외·부분 실패·종결 포함)

- **담당 시나리오**: 시나리오 1 (후반부 — 다운로드 시작 이후), 시나리오 1-a (일부 곡 제외), 시나리오 5 (부분 실패)
- **크기**: M (4-5 파일, 대부분 기존 컴포넌트 확장)
- **의존성**: Task 2 (`lib/converter.ts`, `lib/jobs.ts`, `ProgressScreen`), Task 3 (`ListConfirmScreen`)
- **참조**:
  - next-best-practices — Server Action 폴링 패턴
  - shadcn — `Progress` (진행률 바), Spinner (검색 중·변환 중 카드 아이콘)
- **구현 대상**:
  - `app/actions.ts` — `startPlaylistConversion(items: Song[]): Promise<string>` (jobId 반환). 내부에서 백그라운드로 곡별 순차 처리 (검색 → 다운로드 → 변환). 동시 1요청만 허용
  - `lib/jobs.ts` — 활성 Job 1개 가드, 곡별 status 갱신, 종결 판정
  - `components/curator/ProgressScreen.tsx` — Task 2의 단일 카드 버전을 N 카드 + 진행률 바 + 헤더(완료/실패/진행 중 카운트) + 종결 시 "새 입력으로" 활성으로 확장. URL 모드는 N=1 케이스로 그대로 동작
  - `components/curator/SongProgressCard.tsx` — 6가지 status별 아이콘과 텍스트(완료 / 실패+사유 / 검색 중 / 다운로드 중 / 변환 중 / 대기)
  - `components/curator/ListConfirmScreen.tsx` — "다운로드 시작" 클릭 시 체크된 곡만 `startPlaylistConversion`에 전달
  - `e2e/curator.spec.ts` — 취향 모드 happy path + 부분 실패 시뮬레이션 (의도적으로 매칭 실패할 곡명 사용)
- **수용 기준** (시나리오 1 후반부 + 1-a + 5의 성공 기준 + wireframe screen-2/5의 진행률 시각 요소 파생):
  - [ ] 5곡 모두 체크된 상태에서 "다운로드 시작" → 진행 화면에 카드 5개 표시
  - [ ] 5곡 중 2곡 체크 해제 + "다운로드 시작" → 진행 화면에 카드가 정확히 3개 표시 (체크된 곡만)
  - [ ] 각 카드가 시간 경과에 따라 "완료" 또는 "실패+사유" 종결 상태로 이동한다
  - [ ] 일부 곡이 실패해도 다른 곡의 변환은 정상 진행되어 종결에 도달한다
  - [ ] 실패한 카드에 비어 있지 않은 사유 텍스트(예: "YouTube에서 못 찾음", "변환 실패")가 표시된다
  - [ ] 종결 후 다운로드 폴더에 "완료" 상태인 곡 수만큼의 mp3 파일이 있다
  - [ ] 진행 중 헤더에 "완료 N · 실패 N · 진행 중 N" 형식의 카운트와 진행률 바가 표시된다 (wireframe screen-2)
  - [ ] 모든 카드가 종결 상태가 되면 헤더 텍스트가 "변환 진행"에서 "변환 완료"로 바뀌고 진행률 바가 100%로 표시된다 (wireframe screen-5)
  - [ ] 모든 카드 종결 후 "새 입력으로" 버튼이 활성화되고 클릭 시 입력 화면(초기 상태)으로 복귀한다
  - [ ] 변환 진행 중 다른 입력(취향 모드의 "곡 목록 만들기" 또는 URL 모드의 "변환") 시도 시 입력 버튼이 비활성 상태로 보인다
- **검증**:
  - Vitest: `bun run test -- ProgressScreen ListConfirmScreen` (체크된 곡만 진행, 부분 실패 상태 렌더, 종결 후 버튼 활성)
  - Build: `bun run build`
  - Playwright: `bun run test:e2e -- curator` (happy path 3곡 실제 변환 + 부분 실패 케이스)
  - Browser MCP — 5곡 중 2곡 체크 해제 → 다운로드 시작 → 진행 카드 변화 → 다운로드 폴더 확인. 증거 `artifacts/mp3-curator/evidence/task-4-flow.gif` (gif_creator로 멀티스텝 캡처)
  - Human review (web-design-guidelines) — Task 4 끝에서 전체 feature를 review: 진행 카드 가독성·상태 아이콘 명료성·실패 사유 노출·종결 후 UX

---

### Checkpoint: Task 4 이후 (Feature 완료)
- [ ] `bun run test` 통과 (전체)
- [ ] `bun run build` 성공
- [ ] `bun run test:e2e` 통과
- [ ] 취향 모드 + URL 모드가 실제 브라우저에서 end-to-end로 동작
- [ ] 부분 실패 시나리오에서 실패 카드와 성공 다운로드가 모두 확인됨
- [ ] web-design-guidelines 검토 통과 (또는 후속 조치 기록)

---

## 미결정 항목

- **진행 상태 폴링 간격**: 1초로 시작. 너무 잦으면 부하, 너무 길면 UX 답답. Task 4에서 실측 후 조정.
- **yt-dlp 바이너리 배포**: 시스템 PATH 의존 vs 프로젝트 `bin/` 디렉토리 동봉. Windows 환경에서 사용자가 어떻게 받는지에 따라 결정. Task 2 시작 시 사용자에게 한 번 확인.
- **부분 실패 retry**: spec은 "재시도 버튼 없음(본인용 minimal)". 그러나 yt-dlp 일시 에러(네트워크)는 자동 1회 재시도가 가성비 좋을 수 있다. Task 4에서 결정.

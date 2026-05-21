# MP3 Curator

YouTube 영상을 mp3로 변환하는 **본인용 personal tool**. 두 가지 진입점:

- **취향 모드**: 한 줄 자연어 취향(예: `"운동할 때 좋은 EDM"`) + 곡 수(1–50) → Gemini가 곡 리스트를 만들고 → YouTube에서 매칭 → 미리 듣기로 검토 → 마음에 안 드는 곡은 체크 해제 → 일괄 mp3 다운로드.
- **URL 모드**: YouTube URL 하나를 paste → mp3 한 곡 다운로드.

> ⚠️ **로컬 한정**: idea.md/spec.md의 결정에 따라 로컬에서만 동작합니다. Vercel·다른 클라우드에 배포하지 마세요 — YouTube ToS·저작권·serverless 모델 문제로 동작하지 않습니다.

---

## 새 PC에서 셋업

### 1. Prerequisites

**Bun** (런타임 + 패키지 매니저):
- Windows: `winget install Oven-sh.Bun` 또는 PowerShell `irm https://bun.sh/install.ps1 | iex`
- macOS: `brew install oven-sh/bun/bun`
- Linux: `curl -fsSL https://bun.sh/install | bash`

**yt-dlp + ffmpeg** (변환 백엔드):
- Windows: `winget install yt-dlp.yt-dlp` — 한 줄이 ffmpeg까지 같이 설치합니다.
- macOS: `brew install yt-dlp ffmpeg`
- Linux: `sudo apt install yt-dlp ffmpeg`

**Gemini API key**: https://aistudio.google.com/apikey 에서 발급 (무료 tier 충분).

### 2. Clone + install

```bash
git clone https://github.com/Chuloh-Shin/y2m.git
cd y2m
bun install
```

### 3. `.env.local`

프로젝트 루트에 `.env.local`:

```env
GEMINI_API_KEY=<발급받은 키>
```

**Windows에만** 추가로 두 줄 더:

```env
YT_DLP_PATH=C:/Users/<your-username>/AppData/Local/Microsoft/WinGet/Links/yt-dlp.exe
FFMPEG_PATH=C:/Users/<your-username>/AppData/Local/Microsoft/WinGet/Packages/yt-dlp.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-N-<버전>-win64-gpl/bin/ffmpeg.exe
```

ffmpeg 폴더의 정확한 버전 이름이 필요하면:
```powershell
ls "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\yt-dlp.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\"
```

> ⚠️ **Windows path는 반드시 forward slash(`/`)** 로 쓰세요. 일반 backslash(`\`)는 `\x`·`\f`·`\b` 같은 escape 시퀀스로 해석돼 `ffmpeg.exe`가 `ffmpeg.e`로 잘립니다. 큰따옴표+이중 backslash(`"...\\bin\\ffmpeg.exe"`)도 OK.

**macOS / Linux**: `which yt-dlp && which ffmpeg`로 PATH 확인. 둘 다 경로가 나오면 `YT_DLP_PATH`/`FFMPEG_PATH`는 생략 가능 (코드가 이름만으로 spawn).

### 4. 실행

```bash
bun run dev
```

http://localhost:3000

mp3는 **브라우저의 기본 다운로드 폴더**에 자동 저장됩니다.

---

## 사용 흐름

### 취향 모드
1. 한 줄 취향 입력 + 곡 수 (1–50, 기본 10)
2. `곡 목록 만들기` → Gemini가 곡 리스트 + YouTube 매칭
3. 곡 목록 화면에서:
   - 썸네일·미리 듣기로 매칭 확인
   - 빼고 싶은 곡은 체크 해제
   - `다시 생성`으로 같은 입력 재롤
   - `입력 수정`으로 첫 화면 복귀 (값 보존)
4. `다운로드 시작` → 선택된 곡 수만큼 sequential 변환 → 종결 후 mp3 파일들이 다운로드 폴더에 저장

### URL 모드
화면 아래쪽 URL 입력 + `변환` 한 번 → 카드 1개 진행 → mp3.

---

## 트러블슈팅

| 증상 | 원인 / 처방 |
|---|---|
| `yt-dlp exited 1: WARNING: ffmpeg-location ... .e` | `.env.local`의 backslash가 escape됨 → forward slash로 |
| `LLM 호출이 실패했습니다` | `GEMINI_API_KEY` 누락·만료·할당량 초과 |
| 변환은 완료됐는데 mp3 다운로드가 안 일어남 | 브라우저의 자동 다운로드 차단 — 첫 다운로드 허용 후 이후 OK |
| `이미 변환이 진행 중입니다`가 계속 뜸 | dev 서버를 변환 도중 죽인 적이 있음. 서버를 한 번 더 재시작하면 모듈 로드 시 자동 cleanup |
| 첫 변환이 유난히 느림 | Next.js dev 첫 compile + yt-dlp 첫 호출. 두 번째부터 빠름 |
| `Sign in to confirm you're not a bot` | YouTube 봇 차단. 빈도 높으면 `yt-dlp -U`로 self-update |

---

## M1 probe 재실행 (선택)

LLM·검색 정확도를 새 환경에서 다시 확인하고 싶다면:

```bash
bun run scripts/probe.ts
```

5개 쿼리 × 10곡 × YouTube 매칭 = 50건. ≥ 70%면 OK (참조값: 88%, `artifacts/mp3-curator/evidence/probe.md`).

---

## 개발

```bash
bun run test          # vitest (단위·통합)
bun run test:watch    # vitest watch
bun run test:e2e      # playwright e2e (시작 전 한 번: bunx playwright install chromium)
bun run build         # next build
bun run lint          # eslint
```

테스트 파일 컨벤션:
- `*.test.tsx` / `*.test.ts` — Vitest, colocated
- `e2e/*.spec.ts` — Playwright

### 프로젝트 구조

| 경로 | 역할 |
|---|---|
| `app/` | Next.js App Router, server actions, route handlers |
| `components/curator/` | mp3-curator UI (Input / ListConfirm / Progress / SongListItem / SongProgressCard / CuratorApp) |
| `components/ui/` | shadcn 컴포넌트 (건드리지 않음) |
| `lib/llm.ts` | Gemini wrapper |
| `lib/youtube.ts` | youtubei.js wrapper |
| `lib/converter.ts` | yt-dlp + ffmpeg subprocess |
| `lib/jobs.ts` | In-memory job store (globalThis-pinned) |
| `types/` | 도메인 타입 |
| `scripts/probe.ts` | M1 사전 검증 노트북 스크립트 |
| `artifacts/mp3-curator/` | spec-driven 산출물 (idea / spec / wireframe / plan / learnings / evidence) |

### Spec-driven 워크플로우

이 프로젝트는 spec-driven 워크플로우로 만들어졌습니다. 다음 feature를 추가하려면 같은 흐름을 따르세요:

```
/idea-refine → /write-spec → /sketch-wireframe → /draft-plan → /execute-plan → /compound
```

자세한 워크플로우는 `CLAUDE.md`와 `.claude/skills/` 참조. 이번 feature가 남긴 함정·교훈은 `artifacts/mp3-curator/learnings.md`에 6개 항목으로 정리되어 있습니다.

---

## 기술 스택

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · shadcn (radix-vega) · Vitest · Playwright · Bun.

외부 의존:
- `@google/genai` — Gemini API
- `youtubei.js` — YouTube 비공식 검색 (`youtube-search-api`는 batch에서 무너져 교체 — learnings 참조)
- `yt-dlp` + `ffmpeg` — 시스템 바이너리

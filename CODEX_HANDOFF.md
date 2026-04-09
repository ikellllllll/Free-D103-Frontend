# Free-D103-Frontend — Codex 핸드오프 문서

> 이 문서는 Claude가 작업한 내용을 Codex가 이어받아 작업할 수 있도록 정리한 인수인계 문서입니다.

---

## 프로젝트 개요

**AI Interview Guide (AIG)** — 코딩 과제를 풀고 AI 피드백을 받는 웹 플랫폼.

- **스택**: Next.js 14.2 (App Router), TypeScript, Zustand, React Query, Monaco Editor
- **스타일**: 커스텀 CSS (Tailwind 없음), CSS 변수 기반 디자인 토큰, lucide-react 아이콘
- **운영**: pm2 (`studio-pyan-frontend`), `next start -H 127.0.0.1 -p 3002`, nginx 리버스 프록시
- **배포**: git push → 서버에서 git pull → next build → pm2 restart 순서

---

## 서버 환경

| 항목 | 값 |
|------|----|
| 앱 디렉토리 | `/home/studio/apps/Free-D103-Frontend` |
| pm2 앱명 | `studio-pyan-frontend` |
| 포트 | `3002` |
| 상태 파일 | `/home/studio/logs/ai-edit/state.json` |
| 워크숍 상태 파일 | `/home/studio/logs/preview-workshop/state.json` |
| flock 잠금 파일 | `/home/studio/logs/app-dir.lock` |
| OpenClaw 바이너리 | `/home/openclaw-studio/.openclaw/bin/openclaw` |
| OpenClaw 유저 | `openclaw-studio` |
| AI 에디트 워크스페이스 | `/home/openclaw-studio/ai-edit-workspace` |
| 재시작 스크립트 | `/home/studio/deploy/restart-frontend.sh` |
| GitHub 리포 | `git@github.com:ikellllllll/Free-D103-Frontend.git` |
| GitHub SSH 키 | `sudo -u openclaw-studio ssh -i /home/openclaw-studio/.ssh/id_ed25519_github` |

---

## 주요 기능 구조

### 1. AI UI 에디터 (AiEdit)

사용자가 자연어로 UI 수정을 요청하면 OpenClaw 에이전트가 코드를 직접 수정하는 기능.

**흐름:**
```
브라우저 → POST /api/ai-edit → lib/ai-edit/server.ts (startAiEdit)
  → scripts/ai-edit-runner.js (백그라운드 프로세스)
    → 워크스페이스 준비 (rsync appDir → ai-edit-workspace)
    → OpenClaw 에이전트 실행
    → rsync back (ai-edit-workspace → appDir)
    → Next.js HMR 자동 감지 (dev 모드 시)
  → GET /api/ai-edit/status (폴링, 3.5초 간격)
```

**관련 파일:**
- `components/ai-edit/AiEditFloat.tsx` — 플로팅 채팅 UI
- `lib/ai-edit/server.ts` — 서버 로직 (상태 읽기/쓰기, 러너 스폰)
- `lib/ai-edit/types.ts` — 타입 정의
- `scripts/ai-edit-runner.js` — 백그라운드 실행 스크립트 (Node.js, 컴파일 없음)
- `app/api/ai-edit/route.ts` — POST 엔드포인트
- `app/api/ai-edit/status/route.ts` — GET 폴링 엔드포인트

**동시성 제어:**
- `flock -s` (공유 잠금): appDir 읽을 때
- `flock -x` (배타 잠금): appDir에 쓸 때
- 크로스 체크: ai-edit ↔ workshop 각자 상대방 상태 파일 읽어서 busy 여부 확인
- 동시 실행 불가 시 큐에 추가 → idle 상태 감지 시 자동 시작

**주의사항 (버그 수정 완료):**
- `rsync -a`가 목적지 디렉토리 소유권까지 덮어씀 → `chown -R openclaw-studio` 를 rsync 직후, `ln -sfn` 전에 실행해야 함
- 워크숍으로 인해 큐에 들어간 작업은 워크숍 종료 후 자동으로 러너가 띄워짐 (`readAiEditState`에서 처리)

### 2. 워크숍 (Workshop)

AI가 UI 변형을 생성하고 프리뷰 → 프로모트하는 기능. ai-edit과 동일한 appDir 잠금을 공유함.

**관련 파일:**
- `lib/workshop/server.ts`
- `app/api/workshop/` 하위

### 3. IDE (IdeShell)

Monaco Editor 기반 코딩 환경. 파일 트리, AI 채팅, AI 수정 제안, 실행/테스트/제출 기능.

**관련 파일:**
- `components/ide/IdeShell.tsx` (~1260줄)

---

## 레이아웃 구조

```
app/layout.tsx                   ← 전역 (Toast, AiEditFloat 포함)
├── app/(auth)/layout.tsx        ← 로그인/회원가입 (사이드바 없음)
└── app/(main)/layout.tsx        ← 인증된 페이지들
    ├── AuthGate                 ← 미인증 시 /login 리다이렉트
    ├── AppSidebar               ← 좌측 52px 아이콘 사이드바
    └── <main class="page-shell"> ← 콘텐츠 영역 (풀스크린)
```

**CSS 핵심 변수:**
```css
--bg: #1b1917           /* 메인 배경 (따뜻한 다크) */
--accent: #d97757       /* 주 강조색 (주황/테라코타) */
--sidebar-bg: #141210   /* 사이드바 배경 */
--sidebar-w: 52px       /* 사이드바 너비 */
```

---

## 디자인 원칙

- **커스텀 CSS만 사용** — Tailwind 없음. className은 반드시 `app/globals.css`에 정의된 클래스 사용
- **아이콘**: lucide-react
- **폰트**: IBM Plex Sans KR (본문), JetBrains Mono (코드)
- **애니메이션**: `fade-up`, `fade-in`, `slide-in` 키프레임 정의됨
- **라이트/다크 모드**: `html[data-theme="light"]` CSS 변수 오버라이드 방식

---

## 주요 스토어 (Zustand)

| 파일 | 역할 |
|------|------|
| `store/authStore.ts` | 로그인 상태, user 정보 |
| `store/themeStore.ts` | 다크/라이트 테마 |
| `store/uiStore.ts` | Toast 알림 |
| `store/ideStore.ts` | IDE 패널 상태, 파일, 선택 영역 등 |

---

## 남은 작업 / 개선 가능 항목

- [ ] OpenClaw 에이전트 실행 중 실시간 로그 스트리밍 (현재는 완료 후 결과만 표시)
- [ ] AI 에디터 히스토리 (이전 작업 목록 및 되돌리기)
- [ ] 모바일 대응 (현재 모바일 경고 화면만 있음)
- [ ] 과제 목록 페이지 아이콘 추가 (ProblemList 텍스트 기반)
- [ ] 워크숍 페이지 UI 개선
- [ ] IDE 저장 시 실제 서버 연동 (현재 mockApi)

---

## 배포 방법

```bash
# 1. 코드 변경 후 git push (GitHub)
git add -A && git commit -m "..." && git push

# 2. 서버에서 (studio 유저)
cd /home/studio/apps/Free-D103-Frontend
git pull
npx next build
pm2 restart studio-pyan-frontend
```

> `scripts/ai-edit-runner.js`는 Next.js 빌드 없이 런타임에 직접 읽히므로
> 이 파일만 수정한 경우 `next build` 없이 상태 파일만 초기화해도 됨.

---

## AI 에디트 수동 초기화

작업이 stuck 됐을 때:
```bash
cat > /home/studio/logs/ai-edit/state.json << 'EOF'
{
  "configured": true, "status": "idle", "jobId": null, "pid": null,
  "prompt": "", "targetPath": "", "currentStep": null, "thinking": null,
  "error": null, "startedAt": null, "completedAt": null,
  "updatedAt": "2026-01-01T00:00:00.000Z", "queue": []
}
EOF
```

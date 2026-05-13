"use client";

import dynamic from "next/dynamic";
import { Sun, Moon, Copy, Check, LogOut, Save, Eye, PencilLine } from "lucide-react";
import { useRouter } from "next/navigation";
import type { DragEvent as ReactDragEvent, KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import React, { Fragment, useCallback, useEffect, useMemo, useReducer, useRef, useState, type JSX } from "react";
import { flushSync } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Badge } from "@/components/common/Badge";
import { Card } from "@/components/common/Card";
import { LangIcon } from "@/components/common/LangIcon";
import { useRouteScope } from "@/components/routing/RouteScopeProvider";
import { TracePanel } from "@/components/ide/TracePanel";
import { HarnessPanel } from "@/components/ide/HarnessPanel";
import { SubmissionResultPanel } from "@/components/ide/SubmissionResultPanel";
import { TestResultRow } from "@/components/ide/TestResultRow";
import { TraceWorkbench } from "@/components/ide/TraceWorkbench";
import { useAiChat } from "@/hooks/useAiChat";
import { mockApi } from "@/lib/api/mockApi";
import { problemApi } from "@/lib/api/problemApi";
import { isBackendProblemId, isBackendSessionId, sessionApi } from "@/lib/api/sessionApi";
import { parseApiDateTime } from "@/lib/dateTime";
import { getProblemById } from "@/lib/mock-data";
import type { TraceEvent } from "@/lib/types/ai";
import type { WorkspaceFile } from "@/lib/types/session";
import type { AgentPatch, AgentRunTrace } from "@/lib/types/trace";
import type { BottomPanelTab, SelectionRange, SidebarView } from "@/store/ideStore";
import { useIdeStore } from "@/store/ideStore";
import { useThemeStore } from "@/store/themeStore";
import { useUiStore } from "@/store/uiStore";

// @monaco-editor/react 의 default loader 는 cdn(jsdelivr) 에서 monaco.js 받음.
// 첫 로드 시 ~2.5MB 추가 + cdn 장애 시 IDE 가 안 뜸 + 오프라인 사용 불가.
// loader.config({ monaco }) 로 번들된 npm 패키지를 강제로 사용 → cdn 의존 제거 + 명시적 lifecycle.
// SSR 환경에선 monaco import 가 실패하므로 client 에서만 동적으로 처리.
//
// 추가: MonacoEnvironment.getWorker 정의 — npm 패키지를 직접 쓰면 worker URL 자동 추정이 깨져서
// "Could not create web worker(s). Falling back to main thread" 경고가 뜬다. 메인 스레드 fallback
// 으로 동작은 하지만 IntelliSense 가 느려지고 UI freeze 위험. 인라인 blob worker 로 안전 처리.
if (typeof window !== "undefined") {
  // 인라인 blob worker — monaco-editor 의 esm worker 파일을 dynamic import 해서 Worker 로 spawn.
  // 빌드 시 webpack 가 ?worker query 처리 못 하면 fallback (main thread) 가 작동하니 안전.
  const w = window as unknown as { MonacoEnvironment?: { getWorker?: (workerId: string, label: string) => Worker } };
  if (!w.MonacoEnvironment) {
    w.MonacoEnvironment = {
      getWorker: (_workerId: string, label: string) => {
        // label: "editorWorkerService" | "json" | "css" | "html" | "typescript" | "javascript"
        // 우리는 주로 코드 편집만 — editorWorkerService 면 충분. 다른 label 도 같은 worker fallback.
        // monaco esm 의 editor.worker.js 만 임포트해서 사용.
        const workerUrl = new URL(
          /* webpackChunkName: "monaco-editor-worker" */
          "monaco-editor/esm/vs/editor/editor.worker.js",
          import.meta.url
        );
        return new Worker(workerUrl, { type: "module", name: label });
      }
    };
  }

  import("@monaco-editor/react").then(({ loader }) => {
    import("monaco-editor").then((monaco) => {
      loader.config({ monaco });
    }).catch(() => {
      /* monaco-editor npm 패키지 없으면 cdn fallback 유지 */
    });
  });
}

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <div className="editor-loading">에디터를 불러오는 중...</div>
});

const MonacoDiffEditor = dynamic(() => import("@monaco-editor/react").then((mod) => mod.DiffEditor), {
  ssr: false,
  loading: () => <div className="editor-loading">Diff 에디터를 불러오는 중...</div>
});

const activityItems: Array<{ id: SidebarView; icon: string; label: string; description: string }> = [
  { id: "explorer",   icon: "codicon-files",      label: "탐색기",      description: "파일 트리" },
  { id: "search",     icon: "codicon-search",     label: "검색",        description: "파일명과 코드 검색" },
  { id: "trace",      icon: "codicon-pulse",      label: "Trace",       description: "에이전트 실행 기록" },
  { id: "extensions", icon: "codicon-extensions",   label: "확장",   description: "설치된 워크벤치 도구" },
  { id: "harness",    icon: "codicon-circuit-board", label: "하네스", description: "에이전트·스킬·인스트럭션 구성" }
];

const bottomTabs: Array<{ id: BottomPanelTab; label: string }> = [
  { id: "output", label: "출력" },
  { id: "tests", label: "테스트" },
  { id: "submission", label: "제출" },
  { id: "trace", label: "Trace" }
];

type TutorialStepAction =
  | { type: "openProblem" }
  | { type: "openTrace" }
  | { type: "openSidebar"; view: SidebarView }
  | { type: "toggleBottomPanel" }
  | { type: "toggleAi" }
  | { type: "scrollToTopBar" };

interface TutorialStep {
  id: string;
  icon: string;
  title: string;
  summary: string;
  body: Array<{ kind: "p" | "li" | "tip"; text: string }>;
  action?: { label: string; intent: TutorialStepAction };
  /** CSS selector(s) for spotlight targets. First entry is the "main" target used to position the tooltip. Pass null for centered description steps. */
  targetSelector?: string | string[] | null;
  /** Tooltip placement relative to the main target. */
  placement?: "right" | "bottom" | "left" | "top" | "center";
}

const tutorialSteps: TutorialStep[] = [
  {
    id: "intro",
    icon: "codicon-question",
    title: "AIG IDE 둘러보기",
    summary: "각 영역을 직접 클릭하며 사용법을 익혀 보세요.",
    body: [
      { kind: "p", text: "이 안내는 IDE 위에 떠 있는 오버레이입니다. 강조된 영역을 직접 클릭해도 되고, '다음' 버튼으로 넘겨도 됩니다." },
      { kind: "li", text: "9단계로 풀이 흐름을 따라갑니다" },
      { kind: "li", text: "강조된 영역은 그대로 사용 가능 (클릭·드래그 OK)" },
      { kind: "li", text: "언제든 X 버튼으로 종료할 수 있습니다" }
    ],
    targetSelector: null,
    placement: "center"
  },
  {
    id: "problem",
    icon: "codicon-book",
    title: "1. 문제 파악하기",
    summary: "문제 탭에서 요구사항·엔드포인트·테스트를 확인합니다.",
    body: [
      { kind: "p", text: "문제 탭을 자동으로 열어드렸습니다. 화면 위쪽에 문제 요구사항이 보입니다." },
      { kind: "li", text: "요구 사항: 구현해야 할 기능 목록" },
      { kind: "li", text: "엔드포인트: HTTP 메서드와 경로" },
      { kind: "li", text: "공개 테스트: 통과 기준 미리보기" },
      { kind: "tip", text: "아이콘의 숫자 뱃지는 요구사항 개수입니다." }
    ],
    action: { label: "다시 열기", intent: { type: "openProblem" } },
    targetSelector: [".ide-shell__problem", '[data-tutorial-target="problem"]'],
    placement: "center"
  },
  {
    id: "explorer",
    icon: "codicon-files",
    title: "2. 코드 둘러보기",
    summary: "왼쪽 탐색기에 파일 트리가 열렸습니다.",
    body: [
      { kind: "p", text: "일반 소스 파일은 자유롭게 편집·실행 가능합니다. 추가로 AIG 전용 폴더가 두 가지 있습니다." },
      { kind: "li", text: ".worktree/ (ai 뱃지) — Agent 모드가 만든 패치 미리보기" },
      { kind: "li", text: "agent/instruction.md (meta) — 에이전트 보조 지시문" },
      { kind: "li", text: "agent/skills/ (meta) — 에이전트 보조 스킬 정의" },
      { kind: "li", text: "agent/.sandbox/ (temp) — 임시 실행 산출물" },
      { kind: "tip", text: "탐색기에서 파일을 클릭하면 에디터에 열립니다." }
    ],
    action: { label: "탐색기 열기", intent: { type: "openSidebar", view: "explorer" } },
    targetSelector: [".ide-shell__sidebar", '[data-tutorial-target="explorer"]'],
    placement: "right"
  },
  {
    id: "search",
    icon: "codicon-search",
    title: "3. 빠른 검색",
    summary: "사이드바가 검색 탭으로 전환됐습니다.",
    body: [
      { kind: "p", text: "왼쪽 검색창에 키워드를 입력하면 파일명과 코드 내용을 동시에 찾습니다." },
      { kind: "li", text: "결과 클릭 시 해당 라인으로 점프" },
      { kind: "tip", text: "지금 직접 검색어를 입력해 보세요." }
    ],
    action: { label: "검색 열기", intent: { type: "openSidebar", view: "search" } },
    targetSelector: [".ide-shell__sidebar", '[data-tutorial-target="search"]'],
    placement: "right"
  },
  {
    id: "editor",
    icon: "codicon-edit",
    title: "4. 코드 작성",
    summary: "중앙 에디터에서 직접 코드를 작성합니다.",
    body: [
      { kind: "p", text: "Monaco 에디터로 작성하면 30초마다 자동저장됩니다." },
      { kind: "li", text: "미저장 파일은 탭/트리에 점(•)으로 표시" },
      { kind: "li", text: "Ctrl+S 로 즉시 저장 가능" },
      { kind: "tip", text: "상단 탭의 '오른쪽으로 분할' 버튼으로 화면을 둘로 나눌 수도 있습니다." }
    ],
    targetSelector: ".ide-shell__main",
    placement: "center"
  },
  {
    id: "ai",
    icon: "codicon-hubot",
    title: "5. AI에게 묻기",
    summary: "오른쪽에 AI 보조 패널이 열렸습니다.",
    body: [
      { kind: "p", text: "AI 패널에서 두 가지 모드를 상황에 맞게 사용하세요." },
      { kind: "li", text: "Chat 모드: 질문/설명/코드 조각 받기 — 적용은 본인이 직접" },
      { kind: "li", text: "Agent 모드: 작업 위임 → AI가 .worktree/에 패치 생성, Trace 기록" },
      { kind: "li", text: "메시지 입력창 위 토글로 모드 전환" },
      { kind: "tip", text: "메시지를 입력해 보세요. AI 사용 횟수에 제한이 없습니다." }
    ],
    action: { label: "AI 패널 열기", intent: { type: "toggleAi" } },
    targetSelector: [".ide-shell__ai", '[data-tutorial-target="ai"]'],
    placement: "left"
  },
  {
    id: "trace",
    icon: "codicon-pulse",
    title: "6. 에이전트 실행 흐름 확인",
    summary: "Trace 워크벤치로 전환됐습니다.",
    body: [
      { kind: "p", text: "에이전트가 호출한 도구·만진 파일을 시간순으로 볼 수 있습니다." },
      { kind: "li", text: "각 step의 입력·출력 확인" },
      { kind: "li", text: ".worktree/ 패치 결과와 묶어서 검토" },
      { kind: "tip", text: "리포트의 'Trace 활용도' 점수가 여기서 산정됩니다." }
    ],
    action: { label: "Trace 워크벤치 열기", intent: { type: "openTrace" } },
    targetSelector: [".ide-shell__trace-wb", '[data-tutorial-target="trace"]'],
    placement: "center"
  },
  {
    id: "console",
    icon: "codicon-terminal",
    title: "7. 테스트 실행",
    summary: "하단 콘솔 패널이 열렸습니다.",
    body: [
      { kind: "p", text: "콘솔에는 4개 탭이 있어 각각 다른 정보를 보여줍니다." },
      { kind: "li", text: "출력 — 실행 stdout/stderr" },
      { kind: "li", text: "테스트 — 공개 테스트 케이스 결과" },
      { kind: "li", text: "제출 — 채점 진행 상황" },
      { kind: "li", text: "Trace — 도커 러너 실행 로그" },
      { kind: "tip", text: "탭을 클릭해서 직접 전환해 보세요." }
    ],
    action: { label: "콘솔 열기", intent: { type: "toggleBottomPanel" } },
    targetSelector: [".bottom-panel", '[data-tutorial-target="console"]'],
    placement: "top"
  },
  {
    id: "harness",
    icon: "codicon-circuit-board",
    title: "8. 하네스 구성 (선택)",
    summary: "하네스 패널이 열렸습니다.",
    body: [
      { kind: "p", text: "기본 하네스로도 풀이는 가능합니다. 커스텀이 필요할 때만 사용하세요." },
      { kind: "li", text: "에이전트 베이스 모델 변경" },
      { kind: "li", text: "스킬 활성/비활성" },
      { kind: "li", text: "instruction.md 편집" },
      { kind: "tip", text: "이 단계는 건너뛰어도 무방합니다." }
    ],
    action: { label: "하네스 열기", intent: { type: "openSidebar", view: "harness" } },
    targetSelector: [".ide-shell__sidebar", '[data-tutorial-target="harness"]'],
    placement: "right"
  },
  {
    id: "submit",
    icon: "codicon-rocket",
    title: "9. 제출하고 리포트 받기",
    summary: "상단 제출 버튼으로 최종 채점을 받습니다.",
    body: [
      { kind: "p", text: "코드를 다 작성했다면 상단의 제출 버튼을 누르세요." },
      { kind: "li", text: "공개·비공개 테스트가 함께 채점됨" },
      { kind: "li", text: "한 세션에서 여러 번 제출 가능" },
      { kind: "tip", text: "제출 직후 피드백 리포트가 자동 생성됩니다." }
    ],
    targetSelector: '[data-tutorial-target="submit"]',
    placement: "bottom"
  }
];

const TUTORIAL_PROGRESS_KEY = "aig-ide-tutorial-progress-v1";
const TUTORIAL_FIRST_VISIT_KEY = "aig-ide-tutorial-first-visit-v1";

type TourRect = { top: number; left: number; width: number; height: number };

const SPOT_PAD = 6;
const SPOT_RADIUS = 8;
const ADJACENCY_THRESHOLD = 24;

function tourRectsAreAdjacent(a: TourRect, b: TourRect): boolean {
  const aR = a.left + a.width;
  const aB = a.top + a.height;
  const bR = b.left + b.width;
  const bB = b.top + b.height;
  const hGap = Math.max(0, Math.max(a.left, b.left) - Math.min(aR, bR));
  const vGap = Math.max(0, Math.max(a.top, b.top) - Math.min(aB, bB));
  if (hGap === 0 && vGap === 0) return true;
  if (hGap === 0 && vGap <= ADJACENCY_THRESHOLD) return true;
  if (vGap === 0 && hGap <= ADJACENCY_THRESHOLD) return true;
  return false;
}

function groupAdjacentTourRects(rects: TourRect[]): TourRect[][] {
  const groups: TourRect[][] = [];
  const visited = new Set<number>();
  for (let i = 0; i < rects.length; i++) {
    if (visited.has(i)) continue;
    const group: TourRect[] = [rects[i]];
    visited.add(i);
    const queue = [i];
    while (queue.length > 0) {
      const idx = queue.shift()!;
      for (let j = 0; j < rects.length; j++) {
        if (visited.has(j)) continue;
        if (rects.some((_, k) => k === idx || (group.includes(rects[k]) && tourRectsAreAdjacent(rects[k], rects[j])))) {
          if (tourRectsAreAdjacent(rects[idx], rects[j])) {
            visited.add(j);
            group.push(rects[j]);
            queue.push(j);
          }
        }
      }
    }
    groups.push(group);
  }
  return groups;
}

function roundedRectPath(rect: TourRect, pad = SPOT_PAD, radius = SPOT_RADIUS): string {
  const x = rect.left - pad;
  const y = rect.top - pad;
  const w = rect.width + 2 * pad;
  const h = rect.height + 2 * pad;
  const r = Math.min(radius, w / 2, h / 2);
  return [
    `M ${x + r} ${y}`,
    `L ${x + w - r} ${y}`,
    `A ${r} ${r} 0 0 1 ${x + w} ${y + r}`,
    `L ${x + w} ${y + h - r}`,
    `A ${r} ${r} 0 0 1 ${x + w - r} ${y + h}`,
    `L ${x + r} ${y + h}`,
    `A ${r} ${r} 0 0 1 ${x} ${y + h - r}`,
    `L ${x} ${y + r}`,
    `A ${r} ${r} 0 0 1 ${x + r} ${y}`,
    "Z"
  ].join(" ");
}

/**
 * Builds a single rounded-corner path that outlines two horizontally-adjacent rects as one
 * connected shape (L-shape). Assumes `small` is to the LEFT of `big` and small's y-range fits
 * entirely within big's y-range. Returns null if assumption fails.
 */
function lShapePath(small: TourRect, big: TourRect, pad = SPOT_PAD, radius = SPOT_RADIUS): string | null {
  if (small.top < big.top || small.top + small.height > big.top + big.height) return null;
  if (small.left + small.width > big.left) return null; // overlap or wrong order

  const r = radius;
  const Lx = small.left - pad;
  const Ly = small.top - pad;
  const Lw = small.width + 2 * pad;
  const Lh = small.height + 2 * pad;
  const Rx = big.left - pad;
  const Ry = big.top - pad;
  const Rw = big.width + 2 * pad;
  const Rh = big.height + 2 * pad;

  // Guard: ensure radius doesn't exceed available space
  const safeR = Math.min(r, Lw / 2, Lh / 2, Rw / 2, Rh / 2);

  return [
    `M ${Rx + safeR} ${Ry}`,
    `L ${Rx + Rw - safeR} ${Ry}`,
    `A ${safeR} ${safeR} 0 0 1 ${Rx + Rw} ${Ry + safeR}`,
    `L ${Rx + Rw} ${Ry + Rh - safeR}`,
    `A ${safeR} ${safeR} 0 0 1 ${Rx + Rw - safeR} ${Ry + Rh}`,
    `L ${Rx + safeR} ${Ry + Rh}`,
    `A ${safeR} ${safeR} 0 0 1 ${Rx} ${Ry + Rh - safeR}`,
    `L ${Rx} ${Ly + Lh + safeR}`,
    `A ${safeR} ${safeR} 0 0 0 ${Rx - safeR} ${Ly + Lh}`,
    `L ${Lx + safeR} ${Ly + Lh}`,
    `A ${safeR} ${safeR} 0 0 1 ${Lx} ${Ly + Lh - safeR}`,
    `L ${Lx} ${Ly + safeR}`,
    `A ${safeR} ${safeR} 0 0 1 ${Lx + safeR} ${Ly}`,
    `L ${Rx - safeR} ${Ly}`,
    `A ${safeR} ${safeR} 0 0 0 ${Rx} ${Ly - safeR}`,
    `L ${Rx} ${Ry + safeR}`,
    `A ${safeR} ${safeR} 0 0 1 ${Rx + safeR} ${Ry}`,
    "Z"
  ].join(" ");
}

function pathForGroup(group: TourRect[]): string {
  if (group.length === 0) return "";
  if (group.length === 1) return roundedRectPath(group[0]);
  if (group.length === 2) {
    const sorted = [...group].sort((a, b) => a.width * a.height - b.width * b.height);
    const small = sorted[0];
    const big = sorted[1];
    const merged = lShapePath(small, big);
    if (merged) return merged;
  }
  // Fallback: separate rounded paths joined into one string (still renders as 2 shapes)
  return group.map((rect) => roundedRectPath(rect)).join(" ");
}

// AI 사용 횟수 제한은 백엔드에서 더 이상 강제하지 않음 (2026-05-11~).
// AI_REQUEST_QUOTA 상수 + aiQuotaLabel 변수 모두 unused 상태로 정리됨.
// chat 기본 모델과 통일 — UI 하단의 모델 표시(GPT-5 Mini) 와 Agent Build 시 사용 모델을 일치시켜
// "GPT-5.2로 빌드됐는데 채팅엔 GPT-5 Mini 라고 떠서 어떤 모델 쓰는지 모르겠음" 혼란 제거.
const DEFAULT_HARNESS_BASE_MODEL = "GPT_5_MINI";
const HARNESS_BASE_MODELS = new Set([
  "GPT_5_2",
  "GPT_5",
  "GPT_5_MINI",
  "GPT_5_NANO",
  "CLAUDE_4_5_SONNET",
  "CLAUDE_4_5_OPUS",
  "CLAUDE_4_5_HAIKU"
]);

// AI 채팅 모델 선택지 — 백엔드 ModelName enum 과 일치
const CHAT_MODEL_OPTIONS: ReadonlyArray<{ id: string; label: string; provider: "anthropic" | "openai" }> = [
  { id: "CLAUDE_4_5_SONNET", label: "Claude 4.5 Sonnet", provider: "anthropic" },
  { id: "CLAUDE_4_5_OPUS",   label: "Claude 4.5 Opus",   provider: "anthropic" },
  { id: "CLAUDE_4_5_HAIKU",  label: "Claude 4.5 Haiku",  provider: "anthropic" },
  { id: "GPT_5_2",           label: "GPT-5.2",           provider: "openai" },
  { id: "GPT_5",             label: "GPT-5",             provider: "openai" },
  { id: "GPT_5_MINI",        label: "GPT-5 Mini",        provider: "openai" },
  { id: "GPT_5_NANO",        label: "GPT-5 Nano",        provider: "openai" }
];
// 싸피 GMS 게이트웨이에 Claude 모델군은 미등록 (2026-05-12 확인) — GPT_5_MINI 가 동작 확인된 default.
// Claude 활성화되면 CLAUDE_4_5_SONNET 등으로 복귀 가능.
const DEFAULT_CHAT_MODEL = "GPT_5_MINI";
const SOLVE_TIMER_INTERVAL_MS = 1000;
const MAX_SELECTED_CODE_CHARS = 12000;
const SIDEBAR_MIN_WIDTH = 220;
const SIDEBAR_CLOSE_WIDTH = 170;
const AI_PANEL_MIN_WIDTH = 280;
const AI_PANEL_CLOSE_WIDTH = 230;
const BOTTOM_PANEL_MIN_HEIGHT = 140;
const BOTTOM_PANEL_CLOSE_HEIGHT = 105;
const SIDEBAR_REOPEN_WIDTH = SIDEBAR_CLOSE_WIDTH + 1;
const AI_PANEL_REOPEN_WIDTH = AI_PANEL_CLOSE_WIDTH + 1;
const BOTTOM_PANEL_REOPEN_HEIGHT = BOTTOM_PANEL_CLOSE_HEIGHT + 1;

const extensionItems = [
  {
    name: "AIG Assistant",
    summary: "AI 채팅, 코드 수정, 제출 흐름을 IDE 안에서 묶어 주는 보조 패널",
    state: "활성"
  },
  {
    name: "Extension Pack for Java",
    summary: "Java 편집, 테스트 실행, 패키지 구조 탐색용 기본 확장 묶음",
    state: "설치됨"
  },
  {
    name: "Spring Boot Dashboard",
    summary: "서비스 실행과 테스트 흐름을 시각적으로 정리하는 보조 도구",
    state: "설치됨"
  },
  {
    name: "REST Client",
    summary: "엔드포인트 확인과 요청 흐름 점검에 쓰는 API 실험 도구",
    state: "추천"
  }
];

const INITIAL_AGENT_SNAPSHOT_VERSION = 1;

type ExplorerSectionKey = "agent" | "project";
type DragMode = "sidebar" | "ai" | "bottom";

interface DragState {
  mode: DragMode;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
  collapsed: boolean;
}

interface EditorGroupResizeState {
  leftGroupId: string;
  rightGroupId: string;
  startX: number;
  leftWidth: number;
  rightWidth: number;
}

interface TreeNode {
  key: string;
  name: string;
  path: string | null;
  kind: "folder" | "file";
  file?: ExplorerFile;
  children: TreeNode[];
}

interface ExplorerFile extends WorkspaceFile {
  isVirtual?: boolean;
  badge?: string;
}

interface AgentPatchPreview {
  patchId: string;
  filePath: string;
  worktreePath: string;
  additions: number;
  deletions: number;
  summary: string | null;
  sourceFile?: WorkspaceFile;
  previewFile: ExplorerFile;
}

interface MockDiffFileDetail {
  fileId: number;
  path: string;
  name: string;
  language: string;
  content: string;
  updatedAt?: string;
  originType?: string;
  presenceStatus?: string;
}

interface MockAgentDiffPreset {
  source?: MockDiffFileDetail;
  worktree?: MockDiffFileDetail;
  sourceContent?: string;
  modifiedContent?: string;
}

interface ExplorerContextMenuState {
  x: number;
  y: number;
  parentPath: string | null;
  targetPath: string | null;
  targetKind: "root" | "folder" | "file";
}

interface ExplorerCreateDraft {
  kind: "file" | "folder";
  parentPath: string | null;
  value: string;
}

interface ExplorerRenameDraft {
  targetPath: string;
  targetKind: "folder" | "file";
  parentPath: string | null;
  value: string;
}

interface FileWorkspaceTab {
  id: string;
  kind: "file";
  path: string;
  title: string;
  file: WorkspaceFile;
}

interface DiffWorkspaceTab {
  id: string;
  kind: "diff";
  path: string;
  title: string;
  sourcePath: string;
  sourceFile: WorkspaceFile;
  targetFile: ExplorerFile;
}

type WorkspaceTab = FileWorkspaceTab | DiffWorkspaceTab;

interface EditorGroupState {
  id: string;
  tabIds: string[];
  activeTabId: string | null;
}

interface EditorLayoutSnapshot {
  version: 1;
  activeGroupId: string | null;
  groups: EditorGroupState[];
  groupSizes: Record<string, number>;
}

type SavePromptAction =
  | { type: "close-tab"; groupId: string; tabId: string; path: string }
  | { type: "end-session" }
  | { type: "navigate"; href: string };

const AUTO_SAVE_INTERVAL_MS = 30_000;
const AUTO_SAVE_STORAGE_KEY = "aig:ide-auto-save";
const EDITOR_LAYOUT_STORAGE_PREFIX = "aig:ide-editor-layout";
const INITIAL_EDITOR_GROUP_ID = "editor-group-1";
const MAX_EDITOR_GROUPS = 3;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const reorderItems = (items: string[], fromId: string, toId: string, position: "before" | "after") => {
  if (fromId === toId) {
    return items;
  }

  const next = items.filter((item) => item !== fromId);
  const targetIndex = next.indexOf(toId);

  if (targetIndex < 0) {
    return items;
  }

  const insertIndex = position === "after" ? targetIndex + 1 : targetIndex;
  next.splice(insertIndex, 0, fromId);
  return next;
};
const areStringArraysEqual = (left: string[], right: string[]) =>
  left.length === right.length && left.every((value, index) => value === right[index]);
const getEditorLayoutStorageKey = (sessionId: string) => `${EDITOR_LAYOUT_STORAGE_PREFIX}:${sessionId}`;
const resolveHarnessBaseModel = (model?: string | null) =>
  model && HARNESS_BASE_MODELS.has(model) ? model : DEFAULT_HARNESS_BASE_MODEL;
const pad2 = (value: number) => String(value).padStart(2, "0");
const toTimestamp = (value?: string | null) => {
  if (!value) return Date.now();
  const timestamp = parseApiDateTime(value)?.getTime() ?? Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : Date.now();
};
const formatSolveElapsed = (elapsedMs: number) => {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}일 ${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
  }

  if (hours > 0) {
    return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
  }

  return `${pad2(minutes)}:${pad2(seconds)}`;
};

const parseEstimateMs = (estimate: string): number => {
  const minKr = estimate.match(/(\d+(?:\.\d+)?)\s*분/);
  if (minKr) return parseFloat(minKr[1]) * 60000;
  const hr = estimate.match(/(\d+(?:\.\d+)?)\s*h/);
  if (hr) return parseFloat(hr[1]) * 3600000;
  const min = estimate.match(/(\d+(?:\.\d+)?)\s*m/);
  if (min) return parseFloat(min[1]) * 60000;
  return 0;
};
const clampSelectionCode = (code: string) =>
  code.length > MAX_SELECTED_CODE_CHARS ? `${code.slice(0, MAX_SELECTED_CODE_CHARS)}\n/* selection truncated */` : code;
const getFileName = (path: string) => path.split("/").pop() ?? path;
const getFolderPath = (path: string) => path.split("/").slice(0, -1).join("/");
const resolveInitialEditorPath = (files: Array<Pick<WorkspaceFile, "path" | "language">>) => {
  const visibleFiles = files.filter((file) => !file.path.startsWith(".worktree/"));
  const normalizedName = (path: string) => getFileName(path).toLowerCase();
  const pathRank = (path: string) => {
    const lower = path.toLowerCase();
    if (lower === "readme.md") return 0;
    if (normalizedName(lower) === "readme.md" && !lower.includes("/.sandbox/")) return 1;
    if (lower === "agent/harness.md") return 2;
    if (lower.endsWith(".md") || lower.endsWith(".mdx")) return 3;
    return 4;
  };
  const ranked = [...visibleFiles].sort((left, right) => pathRank(left.path) - pathRank(right.path));
  return ranked[0]?.path ?? files[0]?.path ?? null;
};
const getFileExtension = (file: Pick<WorkspaceFile, "path" | "language">) => {
  const name = getFileName(file.path);
  const extension = name.includes(".") ? name.split(".").pop()?.toLowerCase() : "";
  return extension || file.language.toLowerCase();
};

const isMarkdownWorkspaceFile = (file?: Pick<WorkspaceFile, "path" | "language"> | null) => {
  if (!file) {
    return false;
  }

  const lowerPath = file.path.toLowerCase();
  const language = file.language.toLowerCase();
  return lowerPath.endsWith(".md") || lowerPath.endsWith(".mdx") || language === "markdown" || language === "mdx";
};

const MOCK_AGENT_DIFF_PRESETS: Record<string, MockAgentDiffPreset> = {};

const MOCK_AGENT_DIFF_API_PRESETS: Record<string, MockAgentDiffPreset> = {
  "starter/src/main/java/com/example/starter/dto/UserResponse.java": {
    source: {
      fileId: 109,
      path: "starter/src/main/java/com/example/starter/dto/UserResponse.java",
      name: "UserResponse.java",
      language: "java",
      content: `package com.example.starter.dto;

public record UserResponse (Long id, String name, String email) {
}`,
      updatedAt: "2026-04-28T00:33:16.194678"
    },
    worktree: {
      fileId: 2109,
      path: "starter/src/main/java/com/example/starter/dto/UserResponse.java",
      name: "UserResponse.java",
      language: "java",
      content: `package com.example.starter.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record UserResponse(
        Long id,
        String name,
        String email,
        @JsonProperty("isActive")
        boolean active
) {
}`,
      originType: "MODIFIED",
      presenceStatus: "ACTIVE"
    }
  },
  "starter/src/main/java/com/example/starter/controller/UserController.java": {
    source: {
      fileId: 107,
      path: "starter/src/main/java/com/example/starter/controller/UserController.java",
      name: "UserController.java",
      language: "java",
      content: `package com.example.starter.controller;

import com.example.starter.dto.UserResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class UserController {

    @GetMapping("/users")
    public List<UserResponse> getUsers() {
        // TODO: 회원 목록을 name 오름차순으로 조회하여 반환하세요.
        return List.of();
    }
}`,
      updatedAt: "2026-04-28T00:33:16.194678"
    },
    worktree: {
      fileId: 2107,
      path: "starter/src/main/java/com/example/starter/controller/UserController.java",
      name: "UserController.java",
      language: "java",
      content: `package com.example.starter.controller;

import com.example.starter.dto.UserResponse;
import com.example.starter.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Comparator;
import java.util.List;

@RestController
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/users")
    public List<UserResponse> getUsers() {
        return userService.getUsers().stream()
                .sorted(Comparator.comparing(UserResponse::name))
                .toList();
    }
}`,
      originType: "MODIFIED",
      presenceStatus: "ACTIVE"
    }
  },
  "starter/src/main/java/com/example/starter/service/UserService.java": {
    source: {
      fileId: 115,
      path: "starter/src/main/java/com/example/starter/service/UserService.java",
      name: "UserService.java",
      language: "java",
      content: `package com.example.starter.service;

public class UserService {
}`,
      updatedAt: "2026-04-28T00:33:16.194678"
    },
    worktree: {
      fileId: 2115,
      path: "starter/src/main/java/com/example/starter/service/UserService.java",
      name: "UserService.java",
      language: "java",
      content: `package com.example.starter.service;

import com.example.starter.dto.UserResponse;
import com.example.starter.entity.User;
import com.example.starter.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;

    public List<UserResponse> getUsers() {
        return userRepository.findAll().stream()
                .map(u -> new UserResponse(u.getId(), u.getName(), u.getEmail(), u.isActive()))
                .toList();
    }
}`,
      originType: "MODIFIED",
      presenceStatus: "ACTIVE"
    }
  },
  "starter/src/main/java/com/example/starter/entity/User.java": {
    source: {
      fileId: 111,
      path: "starter/src/main/java/com/example/starter/entity/User.java",
      name: "User.java",
      language: "java",
      content: `package com.example.starter.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;

    private String email;

    public Long getId() { return id; }
    public String getName() { return name; }
    public String getEmail() { return email; }
}`,
      updatedAt: "2026-04-28T00:33:16.194678"
    },
    worktree: {
      fileId: 2111,
      path: "starter/src/main/java/com/example/starter/entity/User.java",
      name: "User.java",
      language: "java",
      content: `package com.example.starter.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;

    private String email;

    private boolean active;

    public Long getId() { return id; }
    public String getName() { return name; }
    public String getEmail() { return email; }
    public boolean isActive() { return active; }
}`,
      originType: "MODIFIED",
      presenceStatus: "ACTIVE"
    }
  },
  "starter/src/main/java/com/example/starter/repository/UserRepository.java": {
    source: {
      fileId: 113,
      path: "starter/src/main/java/com/example/starter/repository/UserRepository.java",
      name: "UserRepository.java",
      language: "java",
      content: `package com.example.starter.repository;

import com.example.starter.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, Long> {
}`,
      updatedAt: "2026-04-28T00:33:16.194678"
    },
    worktree: {
      fileId: 2113,
      path: "starter/src/main/java/com/example/starter/repository/UserRepository.java",
      name: "UserRepository.java",
      language: "java",
      content: `package com.example.starter.repository;

import com.example.starter.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface UserRepository extends JpaRepository<User, Long> {

    @Query("SELECT u FROM User u WHERE u.active = true ORDER BY u.name")
    List<User> findAllActiveOrderByName();
}`,
      originType: "MODIFIED",
      presenceStatus: "ACTIVE"
    }
  }
};

const getMockAgentDiffPreset = (path: string) =>
  MOCK_AGENT_DIFF_API_PRESETS[path] ?? MOCK_AGENT_DIFF_PRESETS[path] ?? null;
const DIFF_TAB_PREFIX = "diff:";
const isDiffTabId = (value: string) => value.startsWith(DIFF_TAB_PREFIX);
const createDiffTabId = (path: string) => `${DIFF_TAB_PREFIX}${path}`;
const getWorktreeSourcePath = (path: string) => path.replace(/^\.worktree\//, "");
const ENDPOINT_LINE_REGEX = /^-\s+`((?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+[^`]+)`/;
const inferLanguageFromPath = (path: string) => {
  const lower = path.toLowerCase();
  const extension = lower.includes(".") ? lower.split(".").pop() : "";

  switch (extension) {
    case "java":
      return "java";
    case "kt":
      return "kotlin";
    case "js":
      return "javascript";
    case "jsx":
      return "javascript";
    case "ts":
      return "typescript";
    case "tsx":
      return "typescript";
    case "json":
      return "json";
    case "yml":
    case "yaml":
      return "yaml";
    case "md":
      return "markdown";
    case "xml":
      return "xml";
    case "html":
      return "html";
    case "css":
      return "css";
    case "scss":
      return "scss";
    case "sql":
      return "sql";
    case "properties":
      return "properties";
    default:
      return "plaintext";
  }
};
const replacePathPrefix = (path: string, fromPrefix: string, toPrefix: string) =>
  path === fromPrefix ? toPrefix : path.startsWith(`${fromPrefix}/`) ? `${toPrefix}${path.slice(fromPrefix.length)}` : path;
const appendLocalFolder = (folders: string[], folderPath: string | null) => {
  if (!folderPath || folders.includes(folderPath)) {
    return folders;
  }

  return [...folders, folderPath];
};

// MonacoDiffEditor wrapper — model lifecycle race 근본 fix.
// unmount 직전 setModel({original:null, modified:null}) 명시 호출해 monaco-editor/react 의
// 자동 dispose 와 우리 invalidate 사이 race 를 좁힘. swallow + RAF×2 + 이 wrapper 가 3중 안전망.
function SafeDiffEditor(props: React.ComponentProps<typeof MonacoDiffEditor>) {
  const editorRef = useRef<unknown | null>(null);
  useEffect(() => {
    return () => {
      const ed = editorRef.current as
        | { setModel?: (m: { original: unknown; modified: unknown } | null) => void }
        | null;
      try {
        ed?.setModel?.({ original: null, modified: null });
      } catch {
        /* 이미 dispose 된 케이스 — 무시 */
      }
      editorRef.current = null;
    };
  }, []);
  return (
    <MonacoDiffEditor
      {...props}
      onMount={(editor, monaco) => {
        editorRef.current = editor;
        props.onMount?.(editor, monaco);
      }}
    />
  );
}

// 채팅 답변 markdown 의 코드 블록 — 복사 / 새 파일로 저장 / 현재 파일에 삽입 액션.
// VSCode Copilot Chat / Continue 식 UX. ProblemBriefCodeBlock 과 비슷하지만 액션 버튼 더 풍부.
function ChatCodeBlock({
  language,
  code,
  onCreateFile,
  onInsertCurrent
}: {
  language?: string;
  code: string;
  onCreateFile?: (code: string, language?: string) => void;
  onInsertCurrent?: (code: string) => void;
}) {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setIsCopied(true);
      window.setTimeout(() => setIsCopied(false), 1500);
    } catch {
      /* noop */
    }
  };

  return (
    <div className="chat-codeblock">
      <div className="chat-codeblock__bar">
        <span className="chat-codeblock__lang">{language ?? "text"}</span>
        <div className="chat-codeblock__actions">
          {onInsertCurrent ? (
            <button
              type="button"
              className="chat-codeblock__btn"
              onClick={() => onInsertCurrent(code)}
              title="현재 파일의 커서 위치에 삽입"
            >
              현재 파일에 삽입
            </button>
          ) : null}
          {onCreateFile ? (
            <button
              type="button"
              className="chat-codeblock__btn"
              onClick={() => onCreateFile(code, language)}
              title="새 워크스페이스 파일로 저장"
            >
              새 파일로 저장
            </button>
          ) : null}
          <button
            type="button"
            className="chat-codeblock__btn"
            onClick={handleCopy}
            title="복사"
          >
            {isCopied ? "복사됨" : "복사"}
          </button>
        </div>
      </div>
      <pre className="chat-codeblock__body"><code>{code}</code></pre>
    </div>
  );
}

// 하네스 빌드 상태 indicator — 빌드 버튼 옆 작은 dot/뱃지.
// COMPLETED: 초록 ✓, PARTIAL: 노랑 ⚠ + 카운트, FAILED: 빨강 ✗ + 카운트.
// 클릭하면 valid_errors 드롭다운 펼침, 각 에러 클릭 시 onErrorClick 호출.
function BuildStatusIndicator({
  result,
  onErrorClick
}: {
  result: {
    compileStatus: "COMPLETED" | "PARTIAL" | "FAILED" | string | null;
    validErrors: Array<{ path?: string | null; code?: string | null; message?: string | null }>;
    builtAt: string;
    baseModel: string | null;
  };
  onErrorClick: (err: { path?: string | null; code?: string | null; message?: string | null }) => void;
}) {
  const [open, setOpen] = useState(false);
  const errCount = result.validErrors.length;
  const status = result.compileStatus ?? (errCount === 0 ? "COMPLETED" : "FAILED");
  const variant =
    status === "COMPLETED" ? "ok" : status === "PARTIAL" ? "warn" : status === "FAILED" ? "err" : "idle";
  const icon = variant === "ok" ? "✓" : variant === "warn" ? "⚠" : variant === "err" ? "✗" : "·";
  const label = errCount > 0 ? `${icon} ${errCount}` : icon;
  const builtRel = (() => {
    const diff = Date.now() - new Date(result.builtAt).getTime();
    if (diff < 60_000) return "방금 전";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
    return `${Math.floor(diff / 3_600_000)}시간 전`;
  })();

  return (
    <div className="build-status">
      <button
        type="button"
        className={`build-status__pill build-status__pill--${variant}`}
        onClick={() => setOpen((v) => !v)}
        title={`마지막 빌드: ${status}${result.baseModel ? ` · ${result.baseModel}` : ""} · ${builtRel}${errCount ? ` · 오류 ${errCount}개` : ""}`}
      >
        {label}
      </button>
      {open && errCount > 0 ? (
        <div className="build-status__dropdown" role="dialog" aria-label="빌드 오류 목록">
          <div className="build-status__dropdown-head">
            <strong>검증 오류 {errCount}개</strong>
            <span className="muted-copy">{status} · {builtRel}</span>
          </div>
          <ul className="build-status__list">
            {result.validErrors.slice(0, 20).map((err, idx) => (
              <li key={`${err.path ?? ""}-${err.code ?? ""}-${idx}`}>
                <button
                  type="button"
                  className="build-status__item"
                  onClick={() => {
                    onErrorClick(err);
                    setOpen(false);
                  }}
                >
                  <span className="build-status__item-path">{err.path ?? "(path 없음)"}</span>
                  {err.code ? <code className="build-status__item-code">{err.code}</code> : null}
                  {err.message ? <span className="build-status__item-msg">{err.message}</span> : null}
                </button>
              </li>
            ))}
            {result.validErrors.length > 20 ? (
              <li className="build-status__truncated">+ {result.validErrors.length - 20}개 더</li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

// 사용자 메시지에 첨부된 코드 스니펫 — 클릭으로 펼칠 수 있는 chip.
// VSCode 확장 (Continue / Cline / Copilot Chat) 패턴.
function AttachedCodeChip({ data }: { data: { path: string; code: string; lineRange?: string } }) {
  const [open, setOpen] = useState(false);
  const fileName = data.path.split(/[\\/]/).pop() ?? data.path;
  const lineCount = data.code.split("\n").length;

  return (
    <div className={open ? "attached-code attached-code--open" : "attached-code"}>
      <button
        type="button"
        className="attached-code__toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="attached-code__caret" aria-hidden>{open ? "▾" : "▸"}</span>
        <span className="attached-code__name">{fileName}</span>
        <span className="attached-code__meta">
          {data.lineRange ? `${data.lineRange} · ` : ""}{lineCount}줄
        </span>
      </button>
      {open ? (
        <pre className="attached-code__body"><code>{data.code}</code></pre>
      ) : null}
    </div>
  );
}

function ProblemBriefCodeBlock({ language, code }: { language?: string; code: string }) {
  const [isCopied, setIsCopied] = useState(false);
  const lines = code.trimEnd().split("\n");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code.trimEnd());
      setIsCopied(true);
      window.setTimeout(() => setIsCopied(false), 1500);
    } catch {
      // noop
    }
  };

  return (
    <div className="problem-brief-codeblock">
      {language ? (
        <div className="problem-brief-codeblock__lang">
          {language}
        </div>
      ) : null}
      <button
        type="button"
        onClick={handleCopy}
        className="problem-brief-codeblock__copy"
        aria-label="복사"
      >
        {isCopied ? <Check size={14} strokeWidth={2.4} className="problem-brief-codeblock__copied" /> : <Copy size={14} strokeWidth={2} />}
      </button>
      <div className="problem-brief-codeblock__body">
        <div className="problem-brief-codeblock__lines">
          {lines.map((_, index) => (
            <div key={index} className="problem-brief-codeblock__line">
              {index + 1}
            </div>
          ))}
        </div>
        <pre className="problem-brief-codeblock__content">
          {lines.map((line, index) => (
            <div key={index}>{line}</div>
          ))}
        </pre>
      </div>
    </div>
  );
}

const problemBriefMarkdownComponents = {
  pre({ children }: { children?: React.ReactNode }) {
    const child = Array.isArray(children) ? children[0] : children;
    if (!child || typeof child !== "object") {
      return <pre>{children}</pre>;
    }

    const element = child as React.ReactElement<{ className?: string; children?: React.ReactNode }>;
    const className = element.props.className ?? "";
    const match = /language-(\w+)/.exec(className);
    const code = String(element.props.children ?? "").replace(/\n$/, "");

    return <ProblemBriefCodeBlock language={match?.[1]} code={code} />;
  }
};

function renderHighlightedEndpoint(line: string) {
  const match = line.match(/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(.*)$/);
  if (!match) {
    return <span>{line}</span>;
  }

  const [, verb, rest] = match;
  const verbColor =
    verb === "GET"
      ? "text-green-400"
      : verb === "POST"
        ? "text-blue-400"
        : verb === "PUT" || verb === "PATCH"
          ? "text-amber-400"
          : verb === "DELETE"
            ? "text-rose-400"
            : "text-gray-300";

  return (
    <>
      <span className={`${verbColor} font-bold`}>{verb}</span>
      <span className="text-slate-200"> {rest}</span>
    </>
  );
}

const getMaxSidebarWidth = (viewportWidth: number) => {
  if (viewportWidth <= 0) {
    return 280;
  }

  if (viewportWidth <= 1180) {
    return clamp(Math.round(viewportWidth * 0.22), 200, 228);
  }

  if (viewportWidth <= 1360) {
    return clamp(Math.round(viewportWidth * 0.23), 220, 248);
  }

  return clamp(Math.round(viewportWidth * 0.26), 248, 420);
};

const getMaxAiPanelWidth = (viewportWidth: number) => {
  if (viewportWidth <= 0) {
    return 360;
  }

  if (viewportWidth <= 1180) {
    return clamp(Math.round(viewportWidth * 0.25), 240, 280);
  }

  if (viewportWidth <= 1360) {
    return clamp(Math.round(viewportWidth * 0.28), 280, 320);
  }

  return clamp(Math.round(viewportWidth * 0.28), 320, 520);
};

const getMaxBottomPanelHeight = (viewportHeight: number) => {
  if (viewportHeight <= 0) {
    return 220;
  }

  // 사용자가 BottomTray 를 충분히 위로 끌어올릴 수 있도록 max 를 viewport 의 ~55% 까지 허용.
  // (이전: 0.3 비율 + 360 px 캡 — 너무 작아서 채점 결과 / 출력 보기 빡빡하다는 의견)
  return clamp(Math.round(viewportHeight * 0.55), 168, 720);
};

const getFolderIconSpec = (folderName: string, folderPath: string | null, isOpen: boolean) => {
  const normalized = folderName.toLowerCase();
  const isPackageFolder =
    folderName.includes(".") &&
    typeof folderPath === "string" &&
    (folderPath.includes("/java/") || folderPath.endsWith("/java") || folderPath.includes("/kotlin/"));

  if (isPackageFolder) {
    return {
      iconClass: "codicon codicon-symbol-namespace",
      kind: "package"
    };
  }

  if (normalized === "java" || normalized === "src" || normalized === "main" || normalized === "test") {
    return {
      iconClass: isOpen ? "codicon codicon-folder-opened" : "codicon codicon-folder",
      kind: "source"
    };
  }

  if (normalized === "resources" || normalized === "static" || normalized === "templates") {
    return {
      iconClass: isOpen ? "codicon codicon-folder-opened" : "codicon codicon-folder",
      kind: "resources"
    };
  }

  if (normalized === ".worktree" || normalized === "worktree") {
    return {
      iconClass: isOpen ? "codicon codicon-folder-opened" : "codicon codicon-folder",
      kind: "worktree"
    };
  }

  return {
    iconClass: isOpen ? "codicon codicon-folder-opened" : "codicon codicon-folder",
    kind: "default"
  };
};

const getFolderDisplayName = (folderName: string, folderPath: string | null) => {
  if (folderName === ".worktree" && folderPath === ".worktree") {
    return "worktree";
  }

  return folderName;
};

const getFileIconSpec = (file: Pick<WorkspaceFile, "path" | "language">) => {
  const fileName = getFileName(file.path).toLowerCase();
  const extension = fileName.includes(".") ? fileName.split(".").pop()?.toLowerCase() : "";

  if (extension === "java") {
    return { iconClass: "codicon codicon-symbol-class", kind: "java" };
  }

  if (
    fileName === "application.properties" ||
    extension === "properties" ||
    extension === "yml" ||
    extension === "yaml"
  ) {
    return { iconClass: "codicon codicon-settings-gear", kind: "config" };
  }

  if (
    fileName === "build.gradle" ||
    fileName === "settings.gradle" ||
    fileName === "gradlew" ||
    fileName === "gradlew.bat" ||
    extension === "gradle"
  ) {
    return { iconClass: "codicon codicon-gear", kind: "gradle" };
  }

  if (fileName === ".gitignore") {
    return { iconClass: "codicon codicon-source-control", kind: "git" };
  }

  if (extension === "md") {
    return { iconClass: "codicon codicon-book", kind: "docs" };
  }

  if (extension === "json") {
    return { iconClass: "codicon codicon-file-code", kind: "json" };
  }

  if (
    extension === "ts" ||
    extension === "tsx" ||
    extension === "js" ||
    extension === "jsx" ||
    extension === "py" ||
    extension === "sql" ||
    extension === "xml" ||
    extension === "html" ||
    extension === "css" ||
    extension === "scss"
  ) {
    return { iconClass: "codicon codicon-file-code", kind: "code" };
  }

  return { iconClass: "codicon codicon-file", kind: "default" };
};

const compressJavaPackageFolders = (nodes: TreeNode[], insideJavaRoot = false): TreeNode[] =>
  nodes.map((node) => {
    if (node.kind === "file") {
      return node;
    }

    const nodePath = node.path ?? "";
    const isJavaRoot = nodePath === "src/main/java" || nodePath === "src/test/java" || nodePath.endsWith("/java");
    const nextInsideJavaRoot = insideJavaRoot || isJavaRoot;

    let mergedName = node.name;
    let mergedKey = node.key;
    let mergedPath = node.path;
    let mergedChildren = node.children;

    if (nextInsideJavaRoot) {
      while (
        mergedChildren.length === 1 &&
        mergedChildren[0]?.kind === "folder" &&
        mergedChildren[0].children.every((child) => child.kind === "folder" || child.kind === "file")
      ) {
        const onlyChild = mergedChildren[0];
        const childHasOnlyFolderDescendants = onlyChild.children.filter((child) => child.kind === "folder").length <= 1;

        mergedName = `${mergedName}.${onlyChild.name}`;
        mergedKey = onlyChild.key;
        mergedPath = onlyChild.path;
        mergedChildren = onlyChild.children;

        if (!childHasOnlyFolderDescendants) {
          break;
        }

        if (onlyChild.children.some((child) => child.kind === "file")) {
          break;
        }
      }
    }

    return {
      ...node,
      key: mergedKey,
      name: mergedName,
      path: mergedPath,
      children: compressJavaPackageFolders(mergedChildren, nextInsideJavaRoot)
    };
  });

const createMockWorktreeContent = (
  sourceFile: WorkspaceFile | undefined,
  patch: AgentPatch,
  summary: string | null
) => {
  const preset = getMockAgentDiffPreset(patch.filePath);
  if (preset?.worktree) {
    return preset.worktree.content;
  }
  if (preset?.modifiedContent) {
    return preset.modifiedContent;
  }

  const base = sourceFile?.content ?? "";

  if (patch.filePath.endsWith(".java")) {
    if (!sourceFile) {
      const className = getFileName(patch.filePath).replace(/\.java$/i, "");
      return [
        `public class ${className} {`,
        "  // Mock AI-generated worktree preview",
        `  // ${summary ?? "Agent generated a new file preview."}`,
        "}"
      ].join("\n");
    }

    let next = base;
    if (next.includes(".get()")) {
      next = next.replace(".get()", '.orElseThrow(() -> new IllegalStateException("Mock preview"))');
    }
    if (next === base && next.includes("return")) {
      next = next.replace("return", "// Mock AI patch preview\n    return");
    }
    if (next === base) {
      next = `${base}\n\n// Mock AI patch preview\n// ${summary ?? `${getFileName(patch.filePath)} updated in worktree.`}`;
    }
    return next;
  }

  if (patch.filePath.endsWith(".yml") || patch.filePath.endsWith(".yaml")) {
    return `${base}\n# Mock AI patch preview\n# ${summary ?? `${getFileName(patch.filePath)} updated.`}`.trim();
  }

  if (patch.filePath.endsWith(".properties")) {
    return `${base}\n# Mock AI patch preview\n# ${summary ?? `${getFileName(patch.filePath)} updated.`}`.trim();
  }

  if (!base) {
    return `# Mock worktree preview\n# ${summary ?? `${getFileName(patch.filePath)} generated by agent`}\n`;
  }

  return `${base}\n\n# Mock AI patch preview\n# ${summary ?? `${getFileName(patch.filePath)} updated in worktree.`}`;
};

const buildAgentPatchPreviews = (files: WorkspaceFile[], runs: AgentRunTrace[]): AgentPatchPreview[] => {
  const latestRunWithPatches = runs.find((run) => run.spans.some((span) => span.patches.length > 0)) ?? runs[0] ?? null;

  if (!latestRunWithPatches) {
    return [];
  }

  const previews = latestRunWithPatches.spans.flatMap((span) =>
    span.patches.map((patch) => {
      const preset = getMockAgentDiffPreset(patch.filePath);
      const sourceFile =
        files.find((file) => file.path === patch.filePath) ??
        (preset?.source
          ? {
              path: preset.source.path,
              language: preset.source.language.toLowerCase(),
              content: preset.source.content
            }
          : preset?.sourceContent
            ? {
                path: patch.filePath,
                language: inferLanguageFromPath(patch.filePath),
                content: preset.sourceContent
              }
          : undefined);
      const worktreePath = `.worktree/${patch.filePath}`;
      const language =
        preset?.worktree?.language.toLowerCase() ?? sourceFile?.language ?? inferLanguageFromPath(patch.filePath);

      return {
        patchId: patch.patchId,
        filePath: patch.filePath,
        worktreePath,
        additions: patch.additions,
        deletions: patch.deletions,
        summary: latestRunWithPatches.summaryText,
        sourceFile,
        previewFile: {
          path: worktreePath,
          language,
          content: createMockWorktreeContent(sourceFile, patch, latestRunWithPatches.summaryText),
          isVirtual: true,
          badge: "ai"
        }
      } satisfies AgentPatchPreview;
    })
  );

  return previews.filter(
    (preview, index, list) => list.findIndex((item) => item.worktreePath === preview.worktreePath) === index
  );
};

const buildExplorerFiles = (files: WorkspaceFile[], injectedVirtualFiles: ExplorerFile[] = []): ExplorerFile[] => {
  const sourceFiles = files.map((file) => ({
    ...file,
    isVirtual: file.path.startsWith(".worktree/"),
    // 'agent/' 로 시작하는 세션 하네스 파일도 메타 배지 표시 (백엔드 SessionHarnessFile)
    badge: file.path.startsWith(".worktree/") ? "ai" : file.path.startsWith("agent/") ? "meta" : undefined
  }));
  const existingPaths = new Set(sourceFiles.map((file) => file.path));
  const previewFiles = injectedVirtualFiles.filter((file) => !existingPaths.has(file.path));

  return [...sourceFiles, ...previewFiles];
};

const buildFileTree = (files: ExplorerFile[], extraFolders: string[] = []) => {
  const root: TreeNode = {
    key: "root",
    name: "root",
    path: null,
    kind: "folder",
    children: []
  };

  files.forEach((file) => {
    const segments = file.path.split("/");
    let current = root;
    let currentPath = "";

    segments.forEach((segment, index) => {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      const isFile = index === segments.length - 1;

      if (isFile) {
        current.children.push({
          key: currentPath,
          name: segment,
          path: file.path,
          kind: "file",
          file,
          children: []
        });
        return;
      }

      let folder = current.children.find((node) => node.kind === "folder" && node.name === segment);

      if (!folder) {
        folder = {
          key: currentPath,
          name: segment,
          path: currentPath,
          kind: "folder",
          children: []
        };
        current.children.push(folder);
      }

      current = folder;
    });
  });

  extraFolders.forEach((folderPath) => {
    const segments = folderPath.split("/").filter(Boolean);
    let current = root;
    let currentPath = "";

    segments.forEach((segment) => {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;

      let folder = current.children.find((node) => node.kind === "folder" && node.name === segment);

      if (!folder) {
        folder = {
          key: currentPath,
          name: segment,
          path: currentPath,
          kind: "folder",
          children: []
        };
        current.children.push(folder);
      }

      current = folder;
    });
  });

  const sortNodes = (nodes: TreeNode[]): TreeNode[] =>
    [...nodes]
      .sort((left, right) => {
        const rootFolderOrder: Record<string, number> = {
          ".worktree": 0,   // AI worktree 변경분 — 항상 최상단 (사용자 주목 영역)
          src: 1,
          agent: 2,
          starter: 3
        };

        const leftRank = left.kind === "folder" && left.path && !left.path.includes("/") ? rootFolderOrder[left.name] ?? 99 : 99;
        const rightRank = right.kind === "folder" && right.path && !right.path.includes("/") ? rootFolderOrder[right.name] ?? 99 : 99;

        if (leftRank !== rightRank) {
          return leftRank - rightRank;
        }

        if (left.kind !== right.kind) {
          return left.kind === "folder" ? -1 : 1;
        }

        return left.name.localeCompare(right.name);
      })
      .map((node) => ({
        ...node,
        children: sortNodes(node.children)
      }));

  return compressJavaPackageFolders(sortNodes(root.children));
};

const isAgentConfigExplorerPath = (path: string) => {
  const normalizedPath = path.replace(/\\/g, "/").toLowerCase();
  const fileName = normalizedPath.split("/").pop() ?? normalizedPath;
  const isMarkdownFile = fileName.endsWith(".md") || fileName.endsWith(".mdx");

  return (
    normalizedPath === "agent" ||
    normalizedPath.startsWith("agent/") ||
    normalizedPath === "agents" ||
    normalizedPath.startsWith("agents/") ||
    normalizedPath === ".agents" ||
    normalizedPath.startsWith(".agents/") ||
    normalizedPath === "skills" ||
    normalizedPath.startsWith("skills/") ||
    normalizedPath.includes("/skills/") ||
    fileName === "agent.md" ||
    fileName === "agents.md" ||
    fileName === "harness.md" ||
    (isMarkdownFile && /(instruction|instuction|instructions|prompt|skill|harness)/.test(fileName))
  );
};

export function IdeShell({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const { withPrefix } = useRouteScope();
  const queryClient = useQueryClient();
  const addToast = useUiStore((state) => state.addToast);
  const setWorkspace = useIdeStore((state) => state.setWorkspace);
  const resetSession = useIdeStore((state) => state.resetSession);
  const activePath = useIdeStore((state) => state.activePath);
  const files = useIdeStore((state) => state.files);
  const unsavedPaths = useIdeStore((state) => state.unsavedPaths);
  const setActivePath = useIdeStore((state) => state.setActivePath);
  const createWorkspaceFile = useIdeStore((state) => state.createWorkspaceFile);
  const renameWorkspaceFile = useIdeStore((state) => state.renameWorkspaceFile);
  const removeWorkspaceFile = useIdeStore((state) => state.removeWorkspaceFile);
  const discardFileChanges = useIdeStore((state) => state.discardFileChanges);
  const hydrateFileContent = useIdeStore((state) => state.hydrateFileContent);
  const markSaved = useIdeStore((state) => state.markSaved);
  const updateFileContent = useIdeStore((state) => state.updateFileContent);
  const selectedCode = useIdeStore((state) => state.selectedCode);
  const selectedRange = useIdeStore((state) => state.selectedRange);
  const setSelection = useIdeStore((state) => state.setSelection);
  const editInstruction = useIdeStore((state) => state.editInstruction);
  const setEditInstruction = useIdeStore((state) => state.setEditInstruction);
  const suggestion = useIdeStore((state) => state.suggestion);
  const setSuggestion = useIdeStore((state) => state.setSuggestion);
  const aiMode = useIdeStore((state) => state.aiMode);
  const setAiMode = useIdeStore((state) => state.setAiMode);
  const runResult = useIdeStore((state) => state.runResult);
  const testResult = useIdeStore((state) => state.testResult);
  const setRunResult = useIdeStore((state) => state.setRunResult);
  const setTestResult = useIdeStore((state) => state.setTestResult);
  const lastSavedAt = useIdeStore((state) => state.lastSavedAt);
  const sidebarView = useIdeStore((state) => state.sidebarView);
  const sidebarOpen = useIdeStore((state) => state.sidebarOpen);
  const sidebarWidth = useIdeStore((state) => state.sidebarWidth);
  const aiOpen = useIdeStore((state) => state.aiOpen);
  const aiPanelWidth = useIdeStore((state) => state.aiPanelWidth);
  const bottomPanelOpen = useIdeStore((state) => state.bottomPanelOpen);
  const bottomPanelTab = useIdeStore((state) => state.bottomPanelTab);
  const bottomPanelHeight = useIdeStore((state) => state.bottomPanelHeight);
  const setSidebarView = useIdeStore((state) => state.setSidebarView);
  const setSidebarOpen = useIdeStore((state) => state.setSidebarOpen);
  const setSidebarWidth = useIdeStore((state) => state.setSidebarWidth);
  const toggleAiOpen = useIdeStore((state) => state.toggleAiOpen);
  const setAiOpen = useIdeStore((state) => state.setAiOpen);
  const setAiPanelWidth = useIdeStore((state) => state.setAiPanelWidth);
  const setBottomPanelOpen = useIdeStore((state) => state.setBottomPanelOpen);
  const setBottomPanelTab = useIdeStore((state) => state.setBottomPanelTab);
  const setBottomPanelHeight = useIdeStore((state) => state.setBottomPanelHeight);
  const lastBuildResult = useIdeStore((state) => state.lastBuildResult);
  const setLastBuildResult = useIdeStore((state) => state.setLastBuildResult);
  const setTraceJumpToId = useIdeStore((state) => state.setTraceJumpToId);
  const stagedAttachments = useIdeStore((state) => state.stagedAttachments);
  const addStagedAttachment = useIdeStore((state) => state.addStagedAttachment);
  const removeStagedAttachment = useIdeStore((state) => state.removeStagedAttachment);
  const clearStagedAttachments = useIdeStore((state) => state.clearStagedAttachments);
  const submissionResult = useIdeStore((state) => state.submissionResult);
  const submissionExecutionId = useIdeStore((state) => state.submissionExecutionId);
  const submissionLoading = useIdeStore((state) => state.submissionLoading);
  const setSubmissionResult = useIdeStore((state) => state.setSubmissionResult);
  const setSubmissionExecutionId = useIdeStore((state) => state.setSubmissionExecutionId);
  const setSubmissionLoading = useIdeStore((state) => state.setSubmissionLoading);
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);

  const editorRef = useRef<any>(null);
  const diffEditorRef = useRef<any>(null);
  const editorHostRef = useRef<HTMLDivElement | null>(null);
  const editorRefsRef = useRef<Map<string, any>>(new Map());
  const diffEditorRefsRef = useRef<Map<string, any>>(new Map());
  const editorHostRefsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const editorGroupRefsRef = useRef<Map<string, HTMLElement>>(new Map());
  const editorGroupResizeRef = useRef<EditorGroupResizeState | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const monacoRef = useRef<any>(null);
  const editorDisposablesRef = useRef<Array<{ dispose: () => void }>>([]);
  const trackedModelUrisRef = useRef<Set<string>>(new Set());
  const selectionDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedBackendFilesRef = useRef<Set<string>>(new Set());
  const allowNextPopStateRef = useRef(false);
  const isDirtyRef = useRef(false);
  const savedBackTargetRef = useRef<string | null>(null);
  const sessionTimeoutHandledRef = useRef(false);
  // 메시지 hydrate 가 sessionId 별로 한 번만 일어나도록 — chat streaming 중 백엔드 refetch 로
  // 메시지가 덮어씌워지는 패턴 방지.
  const messagesHydratedSessionRef = useRef<string | null>(null);
  // IDE 가 처음 마운트된 시각 — session.createdAt 가 비어있을 때 타이머 fallback 으로 사용.
  // useState lazy init 으로 첫 렌더 한 번만 Date.now() 평가 → 매 렌더에서도 stable 보장.
  const [ideMountTimeMs] = useState<number>(() => Date.now());
  const routerRef = useRef(router);
  const activeEditorGroupIdRef = useRef(INITIAL_EDITOR_GROUP_ID);
  const editorLayoutHydratedSessionRef = useRef<string | null>(null);
  const editorLayoutApplyingSnapshotRef = useRef(false);

  const [chatInput, setChatInput] = useState("");
  const [chatModel, setChatModel] = useState<string>(DEFAULT_CHAT_MODEL);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const modelDropdownRef = useRef<HTMLDivElement | null>(null);

  // 모델 드롭다운 외부 클릭 닫기
  useEffect(() => {
    if (!modelDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target as Node)) {
        setModelDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [modelDropdownOpen]);
  const [searchQuery, setSearchQuery] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  // 테스트 실행 시작 시각 — BottomTray "테스트" 탭에서 RUNNING 경과 시간 표시용
  const [testStartedAtMs, setTestStartedAtMs] = useState<number | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [endSessionLoading, setEndSessionLoading] = useState(false);
  const [agentBuildLoading, setAgentBuildLoading] = useState(false);
  const [extensionQuery, setExtensionQuery] = useState("");
  const [completedTutorialSteps, setCompletedTutorialSteps] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = window.localStorage.getItem(TUTORIAL_PROGRESS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(parsed) ? parsed : []);
    } catch {
      return new Set();
    }
  });
  const [tourActive, setTourActive] = useState(false);
  const [tourStepIndex, setTourStepIndex] = useState(0);
  const [tourTargetRects, setTourTargetRects] = useState<Array<{ top: number; left: number; width: number; height: number }>>([]);
  const [agentSnapshotVersion, setAgentSnapshotVersion] = useState(INITIAL_AGENT_SNAPSHOT_VERSION);
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });
  const [activeWorkbenchTab, setActiveWorkbenchTab] = useState<"code" | "problem" | "trace">("code");
  /** 모바일 안내 배너 dismiss 상태 — 한 번 닫으면 세션 동안 안 보임. */
  const [mobileBannerDismissed, setMobileBannerDismissed] = useState(false);
  /** Ctrl+P / Cmd+P 로 토글되는 빠른 파일 열기 팔레트. */
  const [quickOpenVisible, setQuickOpenVisible] = useState(false);
  const [quickOpenQuery, setQuickOpenQuery] = useState("");
  /** Ctrl+/ 로 토글되는 단축키 cheatsheet. */
  const [cheatsheetOpen, setCheatsheetOpen] = useState(false);
  /** 버그 리포트 모달 — 우상단 🐛 버튼 또는 cheatsheet 에서 진입. */
  const [bugReportOpen, setBugReportOpen] = useState(false);
  const [bugReportText, setBugReportText] = useState("");
  /** Agent 요청 전 미해결 worktree 가 있을 때 띄우는 confirm 모달. */
  const [worktreeConfirm, setWorktreeConfirm] = useState<{
    pendingPaths: string[];
    onConfirm: () => void;
  } | null>(null);
  const [editorGroups, setEditorGroups] = useState<EditorGroupState[]>([
    { id: INITIAL_EDITOR_GROUP_ID, tabIds: [], activeTabId: null }
  ]);
  const [activeEditorGroupId, setActiveEditorGroupId] = useState(INITIAL_EDITOR_GROUP_ID);
  const [editorGroupSizes, setEditorGroupSizes] = useState<Record<string, number>>({});
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [draggedTabSourceGroupId, setDraggedTabSourceGroupId] = useState<string | null>(null);
  const [tabDropHint, setTabDropHint] = useState<{ targetId: string; position: "before" | "after" } | null>(null);
  const [explorerContextMenu, setExplorerContextMenu] = useState<ExplorerContextMenuState | null>(null);
  const [explorerCreateDraft, setExplorerCreateDraft] = useState<ExplorerCreateDraft | null>(null);
  const [explorerRenameDraft, setExplorerRenameDraft] = useState<ExplorerRenameDraft | null>(null);
  const [localFolders, setLocalFolders] = useState<string[]>([]);
  const [draggedExplorerPath, setDraggedExplorerPath] = useState<string | null>(null);
  const [folderDropTargetPath, setFolderDropTargetPath] = useState<string | null>(null);
  // 타이머: setInterval + setSolveNow(Date.now()) 흐름이 어떤 환경에서 갱신을 멈추는 패턴이라
  //         useReducer 의 dispatch 로 1초마다 re-render 만 트리거하고
  //         실제 시각은 매 렌더마다 Date.now() 를 그대로 읽는 단순 모델로 정리.
  const [, tickTimer] = useReducer((x: number) => x + 1, 0);
  const solveNow = Date.now();
  const [markdownPreviewOpen, setMarkdownPreviewOpen] = useState(false);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [explorerSections, setExplorerSections] = useState<Record<ExplorerSectionKey, boolean>>({
    agent: true,
    project: true
  });
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(() => new Set());
  const [savePromptAction, setSavePromptAction] = useState<SavePromptAction | null>(null);
  // 테스트 / 제출 / 종료 버튼 실수 방지용 확인 모달
  const [confirmIntent, setConfirmIntent] = useState<"test" | "submit" | "end-session" | null>(null);
  const [savePromptOpen, setSavePromptOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(() => {
    // 기본값: ON. 사용자가 명시적으로 OFF 한 적 있으면 그 값을 따름.
    if (typeof window === "undefined") {
      return true;
    }

    try {
      const raw = window.localStorage.getItem(AUTO_SAVE_STORAGE_KEY);
      if (raw === null) return true; // 처음 진입 → 기본 ON
      return raw === "1";
    } catch {
      return true;
    }
  });
  const { data: session, isLoading } = useQuery({
    queryKey: ["session", sessionId],
    queryFn: () => mockApi.getSession(sessionId)
  });
  const { data: workspace } = useQuery({
    queryKey: ["workspace", sessionId],
    queryFn: () => (isBackendSessionId(sessionId) ? sessionApi.getWorkspace(sessionId) : mockApi.getWorkspace(sessionId)),
    enabled: !!session
  });
  const { data: mockAgentRuns = [] } = useQuery<AgentRunTrace[]>({
    queryKey: ["agentTraces", sessionId],
    queryFn: () =>
      isBackendSessionId(sessionId)
        ? sessionApi.getAgentTraces(sessionId)
        : mockApi.getAgentTraces(sessionId),
    enabled: !!session,
    staleTime: 60_000
  });
  const isApiProblem = isBackendProblemId(session?.problemId ?? "");
  const { data: apiProblem } = useQuery({
    queryKey: ["problem", session?.problemId],
    queryFn: () => problemApi.getProblemDetail(session!.problemId),
    enabled: !!session?.problemId && isApiProblem
  });

  // 제출 채점 결과 폴링 — handleSubmit 에서 submissionExecutionId 가 set 되면 활성화.
  // terminal (COMPLETED/FAILED) 도달 시 refetchInterval=false 로 알아서 멈춤.
  useQuery({
    queryKey: ["submission-poll", submissionExecutionId],
    queryFn: async () => {
      const data = await sessionApi.getSubmissionResult(submissionExecutionId!);
      const rawStatus = (data.rawStatus ?? "RUNNING") as "RUNNING" | "COMPLETED" | "FAILED";
      const isTerminal = rawStatus === "COMPLETED" || rawStatus === "FAILED";

      // 직전 store 상태에서 startedAt 을 보존해야 elapsed 계산이 안 깨짐.
      const prev = useIdeStore.getState().submissionResult;
      setSubmissionResult({
        executionId: String(data.id),
        rawStatus,
        total: data.total ?? 0,
        passed: data.passed ?? 0,
        failed: data.failed ?? 0,
        passRate: data.passRate ?? 0,
        publicPassed: data.publicPassed,
        publicTotal: data.publicTotal,
        hiddenPassed: data.hiddenPassed,
        hiddenTotal: data.hiddenTotal,
        startedAt: prev?.startedAt ?? Date.now(),
        endedAt: isTerminal ? Date.now() : null
      });

      if (isTerminal) {
        setSubmissionLoading(false);
      }
      return data;
    },
    enabled: !!submissionExecutionId && submissionLoading && isBackendSessionId(sessionId),
    refetchInterval: (q) => {
      const status = q.state.data?.rawStatus;
      if (status === "COMPLETED" || status === "FAILED") return false;
      return 1000;
    }
  });

  const activeEditorGroup = useMemo(
    () => editorGroups.find((group) => group.id === activeEditorGroupId) ?? editorGroups[0],
    [activeEditorGroupId, editorGroups]
  );
  const activeTabId = activeEditorGroup?.activeTabId ?? null;
  const openTabPaths = useMemo(
    () => Array.from(new Set(editorGroups.flatMap((group) => group.tabIds))),
    [editorGroups]
  );

  useEffect(() => {
    activeEditorGroupIdRef.current = activeEditorGroupId;
  }, [activeEditorGroupId]);

  useEffect(() => {
    if (!editorGroups.some((group) => group.id === activeEditorGroupId)) {
      const fallbackGroupId = editorGroups[0]?.id ?? INITIAL_EDITOR_GROUP_ID;
      setActiveEditorGroupId(fallbackGroupId);
      activeEditorGroupIdRef.current = fallbackGroupId;
    }
  }, [activeEditorGroupId, editorGroups]);

  const editorGroupIdsKey = useMemo(
    () => editorGroups.map((group) => group.id).join("|"),
    [editorGroups]
  );

  useEffect(() => {
    setEditorGroupSizes((state) => {
      const validIds = editorGroupIdsKey ? new Set(editorGroupIdsKey.split("|")) : new Set<string>();
      const next = Object.fromEntries(Object.entries(state).filter(([groupId]) => validIds.has(groupId)));
      return Object.keys(next).length === Object.keys(state).length ? state : next;
    });
  }, [editorGroupIdsKey]);

  /**
   * Monaco DiffEditor 의 model lifecycle 과 React unmount + workspace invalidate 사이에 race 가 있어
   * 가끔 콘솔에 "TextModel got disposed before DiffEditorWidget model got reset" 가 던져진다.
   * 87949d6 에서 setTimeout(0) yield 로 한 번 잡았지만 multi-edit 흐름에선 다른 경로로 재발.
   *
   * 에디터 동작 자체엔 영향이 없는 cleanup race(이미 dispose 된 model 에 setModel 시도) 이므로
   * 화면에 노출만 차단하고 silently swallow. 더 정밀한 fix(모델 수동 lifecycle 관리)는 추후.
   */
  // Ctrl+P / Cmd+P 글로벌 키 리스너 — 빠른 파일 열기 팔레트 토글.
  // Ctrl+Shift+F / Cmd+Shift+F — 사이드바 검색 탭 열기 + input 자동 포커스.
  // Ctrl+/ — 단축키 cheatsheet 모달.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onKey = (e: KeyboardEvent) => {
      const isCmd = e.ctrlKey || e.metaKey;
      if (isCmd && e.key.toLowerCase() === "p" && !e.shiftKey) {
        e.preventDefault();
        setQuickOpenVisible((v) => !v);
        setQuickOpenQuery("");
      }
      if (isCmd && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setSidebarView("search");
        setSidebarOpen(true);
        // 다음 tick 에 input focus
        window.requestAnimationFrame(() => {
          (document.getElementById("ide-search-query") as HTMLInputElement | null)?.focus();
        });
      }
      if (isCmd && e.key === "/" && !e.shiftKey) {
        e.preventDefault();
        setCheatsheetOpen((v) => !v);
      }
      if (e.key === "Escape" && quickOpenVisible) {
        setQuickOpenVisible(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [quickOpenVisible]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isDiffModelRace = (message: unknown) => {
      const text =
        typeof message === "string"
          ? message
          : message && typeof message === "object" && "message" in (message as Record<string, unknown>)
            ? String((message as { message?: unknown }).message ?? "")
            : "";
      if (!text) return false;
      return (
        text.includes("TextModel got disposed before DiffEditorWidget") ||
        text.includes("TextModel disposed") // monaco 내부 메시지가 살짝 달라질 가능성 대비
      );
    };
    const onError = (event: ErrorEvent) => {
      if (isDiffModelRace(event.error?.message ?? event.message)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isDiffModelRace(event.reason)) {
        event.preventDefault();
      }
    };
    // Monaco DiffEditor 내부가 try/catch 안에서 console.error 로만 출력하는 케이스 — window.error
    // 가 안 잡힌다. 그래서 console.error 도 wrap 해서 동일 패턴이면 swallow.
    // 원본 함수는 그대로 보존하고, 매치 안 되는 메시지는 그대로 흘려보낸다.
    const originalConsoleError = window.console.error.bind(window.console);
    const wrappedConsoleError = (...args: unknown[]) => {
      const first = args[0];
      if (isDiffModelRace(first)) return; // silently drop
      // Error 객체 자체가 두 번째 인자로 오는 케이스 (Monaco style)
      if (args.length > 1 && isDiffModelRace(args[1])) return;
      originalConsoleError(...args);
    };
    window.addEventListener("error", onError, true);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    window.console.error = wrappedConsoleError;
    return () => {
      window.removeEventListener("error", onError, true);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
      window.console.error = originalConsoleError;
    };
  }, []);

  const maxSidebarWidth = getMaxSidebarWidth(viewportSize.width);
  const maxAiPanelWidth = getMaxAiPanelWidth(viewportSize.width);
  const maxBottomPanelHeight = getMaxBottomPanelHeight(viewportSize.height);
  const effectiveSidebarWidth = Math.min(sidebarWidth, maxSidebarWidth);
  const effectiveAiPanelWidth = Math.min(aiPanelWidth, maxAiPanelWidth);
  const effectiveBottomPanelHeight = Math.min(bottomPanelHeight, maxBottomPanelHeight);

  const requestEditorLayout = useCallback(() => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const layoutEditor = (groupId: string, editor: any) => {
          const host = editorHostRefsRef.current.get(groupId);
          if (!editor || !host || typeof editor.layout !== "function") {
            return;
          }

          const width = host.clientWidth;
          const height = host.clientHeight;

          if (!width || !height) {
            return;
          }

          editor.layout({ width, height });
        };

        editorRefsRef.current.forEach((editor, groupId) => layoutEditor(groupId, editor));
        diffEditorRefsRef.current.forEach((editor, groupId) => layoutEditor(groupId, editor));
      });
    });
  }, []);

  const syncMonacoAuxInputs = useCallback(() => {
    editorHostRefsRef.current.forEach((host, groupId) => {
      const imeTextarea = host.querySelector<HTMLTextAreaElement>("textarea.ime-text-area");

      if (imeTextarea) {
        imeTextarea.id = `ide-ime-textarea-${groupId}`;
        imeTextarea.setAttribute("name", `ide-ime-textarea-${groupId}`);
      }
    });
  }, []);

  const updateCursorPosition = useCallback((next: { line: number; column: number }) => {
    setCursorPosition((current) =>
      current.line === next.line && current.column === next.column ? current : next
    );
  }, []);

  const cleanupEditorSubscriptions = useCallback(() => {
    if (selectionDebounceTimerRef.current) {
      clearTimeout(selectionDebounceTimerRef.current);
      selectionDebounceTimerRef.current = null;
    }

    editorDisposablesRef.current.forEach((disposable) => disposable.dispose());
    editorDisposablesRef.current = [];
  }, []);

  const trackMonacoModels = useCallback((editor: any, monaco?: any) => {
    if (monaco) {
      monacoRef.current = monaco;
    }

    const model = editor?.getModel?.();
    const models = model?.original || model?.modified
      ? [model.original, model.modified]
      : model
        ? [model]
        : [];

    models.forEach((item) => {
      const uri = item?.uri?.toString?.();
      if (uri) {
        trackedModelUrisRef.current.add(uri);
      }
    });
  }, []);

  const disposeTrackedMonacoModels = useCallback(() => {
    const monaco = monacoRef.current;
    const trackedUris = trackedModelUrisRef.current;

    if (!monaco?.editor?.getModels || trackedUris.size === 0) {
      return;
    }

    monaco.editor.getModels().forEach((model: any) => {
      const uri = model?.uri?.toString?.();
      if (uri && trackedUris.has(uri)) {
        model.dispose?.();
      }
    });

    trackedUris.clear();
  }, []);

  const { messages, streaming, requestCount, loadMessages, send, abort } = useAiChat(sessionId);

  useEffect(() => {
    const syncViewport = () => {
      setViewportSize({ width: window.innerWidth, height: window.innerHeight });
    };

    syncViewport();
    window.addEventListener("resize", syncViewport);

    return () => {
      window.removeEventListener("resize", syncViewport);
    };
  }, []);

  // 반응형 — viewport 가 좁아지면 sidebar / AI 패널 자동 collapse.
  // 1024 미만: AI 패널 자동 닫기 (작은 화면에선 코드 작성 우선)
  // 768 미만: sidebar 도 자동 닫기 (overlay 모드 권장)
  const prevViewportWidthRef = useRef(0);
  useEffect(() => {
    const w = viewportSize.width;
    if (w <= 0) return;
    const prev = prevViewportWidthRef.current;
    prevViewportWidthRef.current = w;
    // 처음 측정 (prev 0) 도 적용. 좁아지는 방향으로만 자동 처리 (넓어지면 사용자 선택 유지).
    if (prev === 0 || w < prev) {
      if (w < 1024 && aiOpen) setAiOpen(false);
      if (w < 768 && sidebarOpen) setSidebarOpen(false);
    }
  }, [viewportSize.width, aiOpen, sidebarOpen, setAiOpen, setSidebarOpen]);

  useEffect(() => {
    return () => {
      resetSession();
    };
  }, [resetSession]);

  useEffect(() => {
    loadedBackendFilesRef.current.clear();
  }, [sessionId]);

  useEffect(() => {
    return () => {
      cleanupEditorSubscriptions();
      disposeTrackedMonacoModels();
      editorRef.current = null;
      diffEditorRef.current = null;
      editorRefsRef.current.clear();
      diffEditorRefsRef.current.clear();
      editorHostRefsRef.current.clear();
      editorGroupRefsRef.current.clear();
      monacoRef.current = null;
    };
  }, [cleanupEditorSubscriptions, disposeTrackedMonacoModels]);

  useEffect(() => {
    if (workspace?.files?.length) {
      const initial = resolveInitialEditorPath(workspace.files) ?? workspace.files[0]?.path;
      setWorkspace(workspace.files, initial);
      // workspace 가 처음 들어오는 시점에 editorGroups 도 같이 stamp.
      // 자동 sync useEffect 가 같은 결과를 만들기로 되어있지만 일부 환경에서 첫 진입에
      // 빈 탭 상태로 남는 케이스가 있어 여기서 직접 보강.
      if (initial) {
        setEditorGroups((state) => {
          const anyTab = state.some((g) => g.tabIds.length > 0);
          if (anyTab) return state;
          const firstId = state[0]?.id ?? INITIAL_EDITOR_GROUP_ID;
          return [
            { id: firstId, tabIds: [initial], activeTabId: initial },
            ...state.slice(1)
          ];
        });
      }
    }
  }, [setWorkspace, workspace]);

  // 안전망: files 가 로드된 후에도 열린 탭이 없으면 README/우선 파일을 강제로 탭에 추가.
  // editorGroups 에도 직접 push 하고 activePath 도 set.
  useEffect(() => {
    if (!files.length) return;

    const anyGroupHasTab = editorGroups.some((g) => g.tabIds.length > 0);
    const validActive = activePath && files.some((f) => f.path === activePath);
    if (anyGroupHasTab && validActive) return;

    const initial = resolveInitialEditorPath(files);
    if (!initial) return;

    if (!validActive) setActivePath(initial);
    if (!anyGroupHasTab) {
      setEditorGroups((state) => {
        const anyT = state.some((g) => g.tabIds.length > 0);
        if (anyT) return state;
        const firstId = state[0]?.id ?? INITIAL_EDITOR_GROUP_ID;
        return [
          { id: firstId, tabIds: [initial], activeTabId: initial },
          ...state.slice(1)
        ];
      });
    }
  }, [activePath, editorGroups, files, setActivePath]);

  const ensureBackendFileContent = useCallback(
    async (path: string) => {
      if (!isBackendSessionId(sessionId)) {
        return;
      }

      const currentFile = useIdeStore.getState().files.find((file) => file.path === path);
      if (!currentFile) {
        return;
      }

      if (loadedBackendFilesRef.current.has(path)) {
        return;
      }

      if (currentFile.content.trim().length > 0) {
        loadedBackendFilesRef.current.add(path);
        return;
      }

      loadedBackendFilesRef.current.add(path);

      try {
        const payload = await sessionApi.getFileContent(sessionId, path);
        if (payload) {
          hydrateFileContent(path, payload.content, payload.language);
        }
      } catch {
        loadedBackendFilesRef.current.delete(path);
      }
    },
    [hydrateFileContent, sessionId]
  );

  useEffect(() => {
    // 메시지 hydrate — sessionId 별로 한 번만. session 객체 reference 변동
    // (useQuery refetch 등) 에 의존하면 chat 도중 백엔드에서 다시 fetch 해서
    // streaming 중인 assistant 메시지를 덮어씌워 사라지게 한다.
    if (!session) return;
    if (messagesHydratedSessionRef.current === sessionId) return;
    messagesHydratedSessionRef.current = sessionId;
    void loadMessages();
  }, [session, sessionId, loadMessages]);

  useEffect(() => {
    // 타이머는 createdAt 유무와 무관하게 항상 도는 게 맞다.
    // dispatch identity 가 stable 해서 effect 안 cleanup 없이도 매번 갱신 보장.
    const timerId = window.setInterval(tickTimer, SOLVE_TIMER_INTERVAL_MS);
    document.addEventListener("visibilitychange", tickTimer);

    return () => {
      window.clearInterval(timerId);
      document.removeEventListener("visibilitychange", tickTimer);
    };
  }, [tickTimer]);

  useEffect(() => {
    setCollapsedFolders(new Set());
  }, [sessionId]);

  useEffect(() => {
    if (selectedCode) {
      setAiOpen(true);
    }
  }, [selectedCode, setAiOpen]);

  useEffect(() => {
    if (!chatScrollRef.current) {
      return;
    }

    chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [messages, streaming]);

  useEffect(() => {
    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const hosts = Array.from(editorHostRefsRef.current.values());
    if (!hosts.length) {
      return;
    }

    const observer = new ResizeObserver(() => {
      requestEditorLayout();
    });

    hosts.forEach((host) => observer.observe(host));

    return () => {
      observer.disconnect();
    };
  }, [activeTabId, activeWorkbenchTab, editorGroups.length, requestEditorLayout]);

  useEffect(() => {
    if (typeof MutationObserver === "undefined") {
      return;
    }

    const hosts = Array.from(editorHostRefsRef.current.values());
    if (!hosts.length) {
      return;
    }

    syncMonacoAuxInputs();

    const observer = new MutationObserver(() => {
      syncMonacoAuxInputs();
    });

    hosts.forEach((host) =>
      observer.observe(host, {
        childList: true,
        subtree: true
      })
    );

    return () => {
      observer.disconnect();
    };
  }, [activeTabId, activeWorkbenchTab, editorGroups.length, syncMonacoAuxInputs]);

  useEffect(() => {
    const clampWorkbenchLayout = () => {
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      const nextBottomMax = getMaxBottomPanelHeight(viewportHeight);
      if (bottomPanelHeight > nextBottomMax) {
        setBottomPanelHeight(nextBottomMax);
      }

      const nextAiMax = getMaxAiPanelWidth(viewportWidth);
      if (aiPanelWidth > nextAiMax) {
        setAiPanelWidth(nextAiMax);
      }

      const nextSidebarMax = getMaxSidebarWidth(viewportWidth);
      if (sidebarWidth > nextSidebarMax) {
        setSidebarWidth(nextSidebarMax);
      }
    };

    clampWorkbenchLayout();
    window.addEventListener("resize", clampWorkbenchLayout);

    return () => {
      window.removeEventListener("resize", clampWorkbenchLayout);
    };
  }, [aiPanelWidth, bottomPanelHeight, setAiPanelWidth, setBottomPanelHeight, setSidebarWidth, sidebarWidth]);

  useEffect(() => {
    requestEditorLayout();
  }, [
    activePath,
    activeWorkbenchTab,
    aiOpen,
    bottomPanelOpen,
    effectiveAiPanelWidth,
    effectiveBottomPanelHeight,
    effectiveSidebarWidth,
    requestEditorLayout,
    sidebarOpen,
    viewportSize.height,
    viewportSize.width
  ]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const editorGroupResize = editorGroupResizeRef.current;
      if (editorGroupResize) {
        const totalWidth = editorGroupResize.leftWidth + editorGroupResize.rightWidth;
        const minWidth = Math.min(280, Math.floor(totalWidth / 2));
        const nextLeftWidth = clamp(
          editorGroupResize.leftWidth + (event.clientX - editorGroupResize.startX),
          minWidth,
          totalWidth - minWidth
        );

        setEditorGroupSizes((state) => ({
          ...state,
          [editorGroupResize.leftGroupId]: nextLeftWidth,
          [editorGroupResize.rightGroupId]: totalWidth - nextLeftWidth
        }));
        return;
      }

      const dragState = dragStateRef.current;

      if (!dragState) {
        return;
      }

      if (dragState.mode === "sidebar") {
        const rawWidth = dragState.startWidth + (event.clientX - dragState.startX);
        const startedCollapsed = dragState.startWidth === SIDEBAR_CLOSE_WIDTH;
        if (rawWidth <= SIDEBAR_CLOSE_WIDTH) {
          setSidebarOpen(false);
          dragState.collapsed = true;
          return;
        }

        dragState.collapsed = false;
        setSidebarOpen(true);
        const nextWidth = startedCollapsed
          ? clamp(
              Math.max(rawWidth - SIDEBAR_CLOSE_WIDTH, SIDEBAR_REOPEN_WIDTH),
              SIDEBAR_REOPEN_WIDTH,
              maxSidebarWidth
            )
          : clamp(rawWidth, SIDEBAR_MIN_WIDTH, maxSidebarWidth);
        setSidebarWidth(nextWidth);
        return;
      }

      if (dragState.mode === "ai") {
        const rawWidth = dragState.startWidth - (event.clientX - dragState.startX);
        const startedCollapsed = dragState.startWidth === AI_PANEL_CLOSE_WIDTH;
        if (rawWidth <= AI_PANEL_CLOSE_WIDTH) {
          setAiOpen(false);
          dragState.collapsed = true;
          return;
        }

        dragState.collapsed = false;
        setAiOpen(true);
        const nextWidth = startedCollapsed
          ? clamp(
              Math.max(rawWidth - AI_PANEL_CLOSE_WIDTH, AI_PANEL_REOPEN_WIDTH),
              AI_PANEL_REOPEN_WIDTH,
              maxAiPanelWidth
            )
          : clamp(rawWidth, AI_PANEL_MIN_WIDTH, maxAiPanelWidth);
        setAiPanelWidth(nextWidth);
        return;
      }

      const rawHeight = dragState.startHeight - (event.clientY - dragState.startY);
      const startedCollapsed = dragState.startHeight === BOTTOM_PANEL_CLOSE_HEIGHT;
      if (rawHeight <= BOTTOM_PANEL_CLOSE_HEIGHT) {
        setBottomPanelOpen(false);
        dragState.collapsed = true;
        return;
      }

      dragState.collapsed = false;
      setBottomPanelOpen(true);
      const nextHeight = startedCollapsed
        ? clamp(
            Math.max(rawHeight - BOTTOM_PANEL_CLOSE_HEIGHT, BOTTOM_PANEL_REOPEN_HEIGHT),
            BOTTOM_PANEL_REOPEN_HEIGHT,
            maxBottomPanelHeight
          )
        : clamp(rawHeight, BOTTOM_PANEL_MIN_HEIGHT, maxBottomPanelHeight);
      setBottomPanelHeight(nextHeight);
    };

    const handlePointerUp = () => {
      editorGroupResizeRef.current = null;
      dragStateRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [
    maxAiPanelWidth,
    maxBottomPanelHeight,
    maxSidebarWidth,
    setAiOpen,
    setAiPanelWidth,
    setBottomPanelHeight,
    setBottomPanelOpen,
    setSidebarOpen,
    setSidebarWidth
  ]);

  const problem = useMemo(
    () => apiProblem ?? getProblemById(session?.problemId ?? "todo-api"),
    [apiProblem, session?.problemId]
  );
  const traces = useMemo(() => session?.traces ?? [], [session?.traces]);
  const agentPatchPreviews = useMemo(() => buildAgentPatchPreviews(files, mockAgentRuns), [files, mockAgentRuns]);
  const explorerFiles = useMemo(
    () => buildExplorerFiles(files, agentPatchPreviews.map((preview) => preview.previewFile)),
    [agentPatchPreviews, files]
  );
  const agentExplorerFiles = useMemo(
    () => explorerFiles.filter((file) => isAgentConfigExplorerPath(file.path)),
    [explorerFiles]
  );
  const workspaceExplorerFiles = useMemo(
    () => explorerFiles.filter((file) => !isAgentConfigExplorerPath(file.path)),
    [explorerFiles]
  );
  const agentFileTree = useMemo(() => buildFileTree(agentExplorerFiles), [agentExplorerFiles]);
  const workspaceFileTree = useMemo(() => {
    const extraFolders = Array.from(new Set([...localFolders, ".worktree"]));
    const workspaceFolders = extraFolders.filter((folder) => !isAgentConfigExplorerPath(folder));

    return buildFileTree(workspaceExplorerFiles, workspaceFolders);
  }, [localFolders, workspaceExplorerFiles]);
  const openTabs = useMemo(
    () =>
      openTabPaths
        .map((path): WorkspaceTab | null => {
          if (isDiffTabId(path)) {
            const targetPath = path.slice(DIFF_TAB_PREFIX.length);
            const targetFile = explorerFiles.find((file) => file.path === targetPath && file.isVirtual);
            const sourcePath = getWorktreeSourcePath(targetPath);
            const preset = getMockAgentDiffPreset(sourcePath);
            const sourceFile = (() => {
              const existing = files.find((file) => file.path === sourcePath);
              if (existing && existing.content.trim().length > 0) {
                return existing;
              }

              if (preset) {
                if (preset.source) {
                  return {
                    path: preset.source.path,
                    language: preset.source.language.toLowerCase(),
                    content: preset.source.content
                  } satisfies WorkspaceFile;
                }

                return {
                  path: sourcePath,
                  language: targetFile?.language ?? inferLanguageFromPath(sourcePath),
                  content: preset.sourceContent ?? ""
                } satisfies WorkspaceFile;
              }

              if (existing) {
                return existing;
              }

              if (targetFile) {
                return {
                  path: sourcePath,
                  language: targetFile.language,
                  content: ""
                } satisfies WorkspaceFile;
              }

              return undefined;
            })();

            if (!targetFile || !sourceFile) {
              return null;
            }

            return {
              id: path,
              kind: "diff",
              path,
              title: `${getFileName(sourcePath)} diff`,
              sourcePath,
              sourceFile,
              targetFile
            };
          }

          const file = explorerFiles.find((item) => item.path === path);

          if (!file) {
            return null;
          }

          return {
            id: path,
            kind: "file",
            path,
            title: getFileName(path),
            file
          };
        })
        .filter((tab): tab is WorkspaceTab => Boolean(tab)),
    [explorerFiles, files, openTabPaths]
  );
  const activeTab = useMemo(
    () => openTabs.find((tab) => tab.id === activeTabId) ?? null,
    [activeTabId, openTabs]
  );
  const activeFile = useMemo(() => {
    if (activeTab?.kind === "diff") {
      return activeTab.sourceFile;
    }

    if (activeTab?.kind === "file") {
      return activeTab.file;
    }

    const initialPath = resolveInitialEditorPath(files);
    return files.find((file) => file.path === activePath) ?? files.find((file) => file.path === initialPath) ?? files[0] ?? null;
  }, [activePath, activeTab, files]);
  const tabsById = useMemo(() => new Map(openTabs.map((tab) => [tab.id, tab])), [openTabs]);
  const getGroupTabs = useCallback(
    (group: EditorGroupState) =>
      group.tabIds
        .map((tabId) => tabsById.get(tabId))
        .filter((tab): tab is WorkspaceTab => Boolean(tab)),
    [tabsById]
  );
  const latestAgentPatchSummary = agentPatchPreviews[0]?.summary ?? null;

  useEffect(() => {
    const handleDismissExplorerMenu = () => {
      setExplorerContextMenu(null);
    };

    window.addEventListener("click", handleDismissExplorerMenu);
    window.addEventListener("resize", handleDismissExplorerMenu);

    return () => {
      window.removeEventListener("click", handleDismissExplorerMenu);
      window.removeEventListener("resize", handleDismissExplorerMenu);
    };
  }, []);

  useEffect(() => {
    setExplorerContextMenu(null);
    setExplorerCreateDraft(null);
    setExplorerRenameDraft(null);
    setLocalFolders([]);
    setDraggedExplorerPath(null);
    setFolderDropTargetPath(null);
    editorLayoutHydratedSessionRef.current = null;
    editorLayoutApplyingSnapshotRef.current = false;
    setEditorGroups([{ id: INITIAL_EDITOR_GROUP_ID, tabIds: [], activeTabId: null }]);
    setActiveEditorGroupId(INITIAL_EDITOR_GROUP_ID);
    activeEditorGroupIdRef.current = INITIAL_EDITOR_GROUP_ID;
    editorRefsRef.current.clear();
    diffEditorRefsRef.current.clear();
    editorHostRefsRef.current.clear();
    editorGroupRefsRef.current.clear();
    setEditorGroupSizes({});
  }, [sessionId]);

  useEffect(() => {
    const isValidTabId = (tabId: string) => {
      if (isDiffTabId(tabId)) {
        const targetPath = tabId.slice(DIFF_TAB_PREFIX.length);
        return explorerFiles.some((file) => file.path === targetPath && file.isVirtual);
      }

      return files.some((file) => file.path === tabId) || explorerFiles.some((file) => file.path === tabId && file.isVirtual);
    };

    if (!files.length) {
      setEditorGroups((state) => {
        const next = [{ id: state[0]?.id ?? INITIAL_EDITOR_GROUP_ID, tabIds: [], activeTabId: null }];
        return JSON.stringify(state) === JSON.stringify(next) ? state : next;
      });
      return;
    }

    const preferredPath = resolveInitialEditorPath(explorerFiles) ?? files[0].path;
    const fallbackPath =
      openTabPaths.length > 0 && activePath && isValidTabId(activePath)
        ? activePath
        : preferredPath;

    setEditorGroups((state) => {
      const nextGroups = state
        .map((group) => {
          const filtered = group.tabIds.filter(isValidTabId);
          const tabIds = filtered.length ? filtered : group.id === activeEditorGroupIdRef.current ? [fallbackPath] : filtered;
          const activeId = group.activeTabId && tabIds.includes(group.activeTabId) ? group.activeTabId : tabIds[0] ?? null;

          return { ...group, tabIds, activeTabId: activeId };
        })
        .filter((group, index) => index === 0 || group.tabIds.length > 0);

      const normalizedGroups = nextGroups.length
        ? nextGroups
        : [{ id: INITIAL_EDITOR_GROUP_ID, tabIds: [fallbackPath], activeTabId: fallbackPath }];

      const same =
        state.length === normalizedGroups.length &&
        state.every((group, index) => {
          const next = normalizedGroups[index];
          return group.id === next.id && group.activeTabId === next.activeTabId && areStringArraysEqual(group.tabIds, next.tabIds);
        });

      return same ? state : normalizedGroups;
    });
  }, [activePath, explorerFiles, files, openTabPaths.length]);

  useEffect(() => {
    setEditorGroups((state) => {
      const nextGroups = state.map((group) => {
        const validTabIds = group.tabIds.filter((tabId) => tabsById.has(tabId));
        const activeId = group.activeTabId && validTabIds.includes(group.activeTabId)
          ? group.activeTabId
          : validTabIds[0] ?? null;

        return { ...group, tabIds: validTabIds, activeTabId: activeId };
      });

      const same =
        state.length === nextGroups.length &&
        state.every((group, index) => {
          const next = nextGroups[index];
          return group.id === next.id && group.activeTabId === next.activeTabId && areStringArraysEqual(group.tabIds, next.tabIds);
        });

      return same ? state : nextGroups;
    });
  }, [tabsById]);

  useEffect(() => {
    if (!files.length || editorLayoutHydratedSessionRef.current === sessionId) {
      return;
    }

    editorLayoutHydratedSessionRef.current = sessionId;

    const isValidTabId = (tabId: string) => {
      if (isDiffTabId(tabId)) {
        const targetPath = tabId.slice(DIFF_TAB_PREFIX.length);
        return explorerFiles.some((file) => file.path === targetPath && file.isVirtual);
      }

      return files.some((file) => file.path === tabId) || explorerFiles.some((file) => file.path === tabId && file.isVirtual);
    };

    try {
      const rawSnapshot = window.localStorage.getItem(getEditorLayoutStorageKey(sessionId));
      if (!rawSnapshot) {
        return;
      }

      const snapshot = JSON.parse(rawSnapshot) as Partial<EditorLayoutSnapshot>;
      if (!Array.isArray(snapshot.groups)) {
        return;
      }

      const usedGroupIds = new Set<string>();
      const nextGroups = snapshot.groups
        .slice(0, MAX_EDITOR_GROUPS)
        .map((group, index) => {
          const fallbackGroupId = index === 0 ? INITIAL_EDITOR_GROUP_ID : `editor-group-restored-${index + 1}`;
          const groupId = typeof group.id === "string" && group.id.trim() ? group.id : fallbackGroupId;
          const safeGroupId = usedGroupIds.has(groupId) ? `${groupId}-${index + 1}` : groupId;
          const tabIds = Array.from(new Set(Array.isArray(group.tabIds) ? group.tabIds.filter(isValidTabId) : []));

          usedGroupIds.add(safeGroupId);

          return {
            id: safeGroupId,
            tabIds,
            activeTabId: group.activeTabId && tabIds.includes(group.activeTabId) ? group.activeTabId : tabIds[0] ?? null
          };
        })
        .filter((group) => group.tabIds.length > 0);

      if (!nextGroups.length) {
        return;
      }

      const nextActiveGroupId =
        typeof snapshot.activeGroupId === "string" && nextGroups.some((group) => group.id === snapshot.activeGroupId)
          ? snapshot.activeGroupId
          : nextGroups[0].id;
      const nextGroupSizes = Object.fromEntries(
        Object.entries(snapshot.groupSizes ?? {}).filter(
          ([groupId, width]) => nextGroups.some((group) => group.id === groupId) && typeof width === "number" && Number.isFinite(width)
        )
      );

      editorLayoutApplyingSnapshotRef.current = true;
      setEditorGroups(nextGroups);
      setActiveEditorGroupId(nextActiveGroupId);
      activeEditorGroupIdRef.current = nextActiveGroupId;
      setEditorGroupSizes(nextGroupSizes);
    } catch {
      window.localStorage.removeItem(getEditorLayoutStorageKey(sessionId));
    }
  }, [explorerFiles, files, sessionId]);

  useEffect(() => {
    if (!files.length || editorLayoutHydratedSessionRef.current !== sessionId) {
      return;
    }

    if (editorLayoutApplyingSnapshotRef.current) {
      editorLayoutApplyingSnapshotRef.current = false;
      return;
    }

    const groups = editorGroups
      .map((group) => ({
        ...group,
        tabIds: group.tabIds.filter((tabId) => tabsById.has(tabId)),
        activeTabId: group.activeTabId && tabsById.has(group.activeTabId) ? group.activeTabId : group.tabIds.find((tabId) => tabsById.has(tabId)) ?? null
      }))
      .filter((group) => group.tabIds.length > 0)
      .slice(0, MAX_EDITOR_GROUPS);

    if (!groups.length) {
      return;
    }

    const snapshot: EditorLayoutSnapshot = {
      version: 1,
      activeGroupId: groups.some((group) => group.id === activeEditorGroupId) ? activeEditorGroupId : groups[0].id,
      groups,
      groupSizes: Object.fromEntries(
        Object.entries(editorGroupSizes).filter(([groupId, width]) => groups.some((group) => group.id === groupId) && Number.isFinite(width))
      )
    };

    try {
      window.localStorage.setItem(getEditorLayoutStorageKey(sessionId), JSON.stringify(snapshot));
    } catch {
      // noop
    }
  }, [activeEditorGroupId, editorGroupSizes, editorGroups, files.length, sessionId, tabsById]);

  useEffect(() => {
    if (!activeTab) {
      return;
    }

    const nextPath = activeTab.kind === "diff" ? activeTab.sourcePath : activeTab.path;

    // 가드: diff 탭이 가리키는 sourcePath 가 실제 files 에 없으면 setActivePath 호출 금지.
    // (mock fallback / stale localStorage snapshot 으로 가짜 worktree 파일이 explorerFiles 에 들어왔을 때
    //  effect 1568 와 oscillate 하며 React #185 (Maximum update depth) 발생.)
    if (activeTab.kind === "diff" && !files.some((file) => file.path === nextPath)) {
      return;
    }

    if (nextPath !== activePath) {
      setActivePath(nextPath);
    }

    if (activeTab.kind === "diff") {
      setSelection("", null);
      setSuggestion(null);
      setAiMode("chat");
    }
  }, [activePath, activeTab, files, setActivePath, setAiMode, setSelection, setSuggestion]);

  useEffect(() => {
    if (!activeFile?.path) {
      return;
    }

    void ensureBackendFileContent(activeFile.path);

    // diff 탭일 때 sourcePath 도 미리 hydrate (mock preset → real content 점프 깜빡임 방지, #7).
    if (activeTab?.kind === "diff") {
      const sourcePath = activeTab.sourcePath;
      if (sourcePath && sourcePath !== activeFile.path) {
        void ensureBackendFileContent(sourcePath);
      }
    }
  }, [activeFile?.path, activeTab, ensureBackendFileContent]);

  const searchMatches = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();

    if (!keyword) {
      return [];
    }

    return files.flatMap((file) => {
      const pathMatch = file.path.toLowerCase().includes(keyword)
        ? [
            {
              key: `${file.path}-path`,
              path: file.path,
              lineNumber: 1,
              preview: file.path
            }
          ]
        : [];

      const lineMatches = file.content
        .split("\n")
        .map((line, index) => ({ line, lineNumber: index + 1 }))
        .filter((line) => line.line.toLowerCase().includes(keyword))
        .slice(0, 5)
        .map((line) => ({
          key: `${file.path}-${line.lineNumber}`,
          path: file.path,
          lineNumber: line.lineNumber,
          preview: line.line.trim() || "(빈 줄)"
        }));

      return [...pathMatch, ...lineMatches];
    });
  }, [files, searchQuery]);
  const extensionMatches = useMemo(() => {
    const keyword = extensionQuery.trim().toLowerCase();

    if (!keyword) {
      return extensionItems;
    }

    return extensionItems.filter((item) =>
      `${item.name} ${item.summary} ${item.state}`.toLowerCase().includes(keyword)
    );
  }, [extensionQuery]);

  const selectionSummary = selectedRange
    ? `${selectedRange.startLineNumber}:${selectedRange.startColumn} - ${selectedRange.endLineNumber}:${selectedRange.endColumn}`
    : "선택 없음";
  const selectionLabel = selectedRange
    ? `${Math.abs(selectedRange.endLineNumber - selectedRange.startLineNumber) + 1}줄 선택`
    : `Ln ${cursorPosition.line}, Col ${cursorPosition.column}`;
  const lineCount = activeFile?.content.split("\n").length ?? 0;
  // AI 사용 무제한 — quota 변수 제거됨 (2026-05-11~). requestCount 는 다른 곳에서 표시용으로 유지될 수 있음.
  const agentSnapshotLabel = `v0.${agentSnapshotVersion}`;
  const dirtyCount = unsavedPaths.length;
  const canPreviewActiveMarkdown = activeTab?.kind === "file" && isMarkdownWorkspaceFile(activeFile);
  useEffect(() => {
    setMarkdownPreviewOpen(canPreviewActiveMarkdown);
  }, [activeFile?.path, canPreviewActiveMarkdown]);

  const parsedProblemBrief = useMemo(() => {
    if (!problem?.description) {
      return { beforeDescription: "", afterDescription: "", parsedEndpoints: [] as string[] };
    }

    const lines = problem.description.split("\n");
    const parsedEndpoints: string[] = [];
    let firstEndpointIndex = -1;
    let lastEndpointIndex = -1;

    lines.forEach((line, index) => {
      const match = line.match(ENDPOINT_LINE_REGEX);
      if (!match) {
        return;
      }

      if (firstEndpointIndex === -1) {
        firstEndpointIndex = index;
      }

      lastEndpointIndex = index;
      parsedEndpoints.push(match[1].trim());
    });

    if (firstEndpointIndex === -1) {
      return {
        beforeDescription: problem.description.trim(),
        afterDescription: "",
        parsedEndpoints
      };
    }

    return {
      beforeDescription: lines.slice(0, firstEndpointIndex).join("\n").trim(),
      afterDescription: lines.slice(lastEndpointIndex + 1).join("\n").trim(),
      parsedEndpoints
    };
  }, [problem?.description]);
  const resolvedProblemEndpoints = parsedProblemBrief.parsedEndpoints.length
    ? parsedProblemBrief.parsedEndpoints
    : (problem?.endpoints ?? []);
  const resolvedProblemRequirements = problem?.requirements?.length
    ? problem.requirements
    : [];
  const resolvedProblemCases = problem?.publicCases?.length
    ? problem.publicCases
    : [];
  const resolvedProblemCriteria = problem?.criteria?.length
    ? problem.criteria
    : [];
  const problemRequirementsCount = resolvedProblemRequirements.length;
  const problemCasesCount = resolvedProblemCases.length;
  const problemEndpointCount = resolvedProblemEndpoints.length;
  const breadcrumbParts =
    activeWorkbenchTab === "problem"
      ? ["problem", problem?.title ?? "brief"]
      : activeWorkbenchTab === "trace"
        ? ["trace", "에이전트 실행 기록"]
        : activeFile?.path.split("/") ?? [];
  const bottomTabMeta: Record<BottomPanelTab, string> = {
    output: runResult ? `code ${runResult.exitCode}` : "ready",
    tests: testResult ? `${testResult.passed}/${testResult.total}` : "idle",
    submission: submissionResult
      ? submissionLoading
        ? "채점중"
        : `${submissionResult.passed}/${submissionResult.total}`
      : "idle",
    trace: `${traces.length}`
  };
  const activityMeta: Record<SidebarView | "ai" | "output", string | null> = {
    explorer: dirtyCount ? `${dirtyCount}` : openTabs.length ? `${openTabs.length}` : `${files.length}`,
    search: searchQuery.trim() ? `${searchMatches.length}` : null,
    trace: null,
    extensions: `${extensionItems.length}`,
    harness: null,
    ai: null,        // AI 사용 무제한 — 사이드바 뱃지 숨김
    output: testResult ? `${testResult.failed}` : traces.length ? `${traces.length}` : null
  };
  const lastSavedDate = parseApiDateTime(lastSavedAt);
  const lastSavedLabel = lastSavedDate
    ? `저장 ${lastSavedDate.toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      })}`
    : "자동 저장 대기";
  const savePromptTitle =
    savePromptAction?.type === "close-tab"
      ? `${getFileName(savePromptAction.path)}을(를) 저장할까요?`
      : savePromptAction?.type === "navigate"
        ? "페이지를 이동하기 전에 저장할까요?"
        : "세션을 종료하기 전에 저장할까요?";
  const savePromptDescription =
    savePromptAction?.type === "close-tab"
      ? "저장하지 않으면 이 파일의 마지막 저장 이후 변경 내용이 사라집니다."
      : savePromptAction?.type === "navigate"
        ? `${unsavedPaths.length}개의 저장되지 않은 파일이 있습니다. 저장하지 않으면 변경 내용이 사라질 수 있습니다.`
        : `${unsavedPaths.length}개의 저장되지 않은 파일이 있습니다. 세션 종료 후에는 파일 저장, 실행, 제출이 차단될 수 있습니다.`;
  // createdAt 이 없거나 파싱 실패면 IDE 마운트 시각으로 fallback.
  // toTimestamp 헬퍼는 비어있을 때 Date.now() 를 반환하는데 그건 매 렌더마다 새로 갱신되어
  // elapsed 가 항상 0 이 되는 함정이라 여기선 직접 createdAt 만 파싱해서 쓴다.
  // 백엔드 createdAt 이 미래 시각 (timezone 혼동) 으로 해석되는 케이스도 마운트 시각 fallback.
  const parsedCreatedAtMs = session?.createdAt ? parseApiDateTime(session.createdAt)?.getTime() : null;
  const sessionStartMs =
    typeof parsedCreatedAtMs === "number" &&
    Number.isFinite(parsedCreatedAtMs) &&
    parsedCreatedAtMs <= solveNow
      ? parsedCreatedAtMs
      : ideMountTimeMs;
  const solveElapsedMs = Math.max(0, solveNow - sessionStartMs);
  const solveElapsedLabel = formatSolveElapsed(solveElapsedMs);
  const estimateLimitMs = parseEstimateMs(problem?.estimate ?? "");
  const isTimeExpired = estimateLimitMs > 0 && solveElapsedMs >= estimateLimitMs;
  const isOvertime = estimateLimitMs > 0 && solveElapsedMs > estimateLimitMs;
  const overtimeMs = isOvertime ? solveElapsedMs - estimateLimitMs : 0;
  const timerProgress = estimateLimitMs > 0 ? Math.min(1, solveElapsedMs / estimateLimitMs) : 0;
  const timerPhase = isOvertime ? "overtime" : timerProgress >= 0.85 ? "warning" : "normal";
  const showEmptyEditor = activeWorkbenchTab === "code" && openTabs.length === 0;
  const showBottomPanel = bottomPanelOpen;

  useEffect(() => {
    sessionTimeoutHandledRef.current = false;
  }, [sessionId]);

  useEffect(() => {
    if (!session || !problem || !isTimeExpired || sessionTimeoutHandledRef.current) {
      return;
    }

    sessionTimeoutHandledRef.current = true;
    setSavePromptOpen(false);
    setSavePromptAction(null);
    addToast("제한 시간이 지나 세션이 종료되었습니다.", "warning");

    void queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
    void queryClient.invalidateQueries({ queryKey: ["sessions"] });
    router.replace(withPrefix("/problems"));
  }, [addToast, isTimeExpired, problem, queryClient, router, session, sessionId, withPrefix]);

  const handleMount = (groupId: string) => (editor: any, monaco: any) => {
    editorRefsRef.current.set(groupId, editor);
    if (activeEditorGroupIdRef.current === groupId) {
      editorRef.current = editor;
    }
    trackMonacoModels(editor, monaco);
    const initialPosition = editor.getPosition();

    if (initialPosition) {
      updateCursorPosition({
        line: initialPosition.lineNumber,
        column: initialPosition.column
      });
    }

    const selectionDisposable = editor.onDidChangeCursorSelection(() => {
      if (activeEditorGroupIdRef.current !== groupId) {
        return;
      }

      if (selectionDebounceTimerRef.current) clearTimeout(selectionDebounceTimerRef.current);
      selectionDebounceTimerRef.current = setTimeout(() => {
        const selection = editor.getSelection();

        if (!selection || selection.isEmpty()) {
          const position = editor.getPosition();

          if (position) {
            updateCursorPosition({
              line: position.lineNumber,
              column: position.column
            });
          }

          setSelection("", null);
          return;
        }

        const position = selection.getPosition();
        const model = editor.getModel();
        if (!model) return;

        const code = clampSelectionCode(model.getValueInRange(selection) ?? "");
        const lineCount = model.getLineCount();
        const startLine = Math.min(selection.startLineNumber, lineCount);
        const endLine = Math.min(selection.endLineNumber, lineCount);
        const range: SelectionRange = {
          startLineNumber: startLine,
          startColumn: selection.startColumn,
          endLineNumber: endLine,
          endColumn: selection.endColumn
        };

        updateCursorPosition({
          line: position.lineNumber,
          column: position.column
        });
        setSelection(code, range);
      }, 80);
    });
    editorDisposablesRef.current.push(selectionDisposable);

    requestEditorLayout();
    syncMonacoAuxInputs();
  };

  const handleDiffMount = (groupId: string) => (editor: any, monaco: any) => {
    diffEditorRefsRef.current.set(groupId, editor);
    if (activeEditorGroupIdRef.current === groupId) {
      diffEditorRef.current = editor;
    }
    trackMonacoModels(editor, monaco);
    requestEditorLayout();

    // dispose 시점에 refs cleanup — leak 방지 + 후속 race 발생 시 setModel 호출이 stale editor 에
    // 가지 않도록. Monaco DiffEditor 의 onDidDispose 는 widget 자체 dispose 후 호출.
    try {
      editor.onDidDispose?.(() => {
        if (diffEditorRefsRef.current.get(groupId) === editor) {
          diffEditorRefsRef.current.delete(groupId);
        }
        if (diffEditorRef.current === editor) {
          diffEditorRef.current = null;
        }
      });
    } catch {
      /* monaco API 버전 차이로 onDidDispose 없으면 무시 */
    }
  };

  const handleTabRailWheel = useCallback((event: ReactWheelEvent<HTMLDivElement>) => {
    const rail = event.currentTarget;

    if (rail.scrollWidth <= rail.clientWidth) {
      return;
    }

    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;

    if (!delta) {
      return;
    }

    rail.scrollLeft += delta;
  }, []);

  const beginResize = (mode: DragMode) => (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    dragStateRef.current = {
      mode,
      startX: event.clientX,
      startY: event.clientY,
      startWidth:
        mode === "sidebar"
          ? sidebarOpen
            ? effectiveSidebarWidth
            : SIDEBAR_CLOSE_WIDTH
          : aiOpen
            ? effectiveAiPanelWidth
            : AI_PANEL_CLOSE_WIDTH,
      startHeight: bottomPanelOpen ? effectiveBottomPanelHeight : BOTTOM_PANEL_CLOSE_HEIGHT,
      collapsed: false
    };

    document.body.style.cursor = mode === "bottom" ? "row-resize" : "col-resize";
    document.body.style.userSelect = "none";
  };

  const beginEditorGroupResize =
    (leftGroupId: string, rightGroupId: string) => (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();

      const leftGroup = editorGroupRefsRef.current.get(leftGroupId);
      const rightGroup = editorGroupRefsRef.current.get(rightGroupId);
      if (!leftGroup || !rightGroup) {
        return;
      }

      editorGroupResizeRef.current = {
        leftGroupId,
        rightGroupId,
        startX: event.clientX,
        leftWidth: leftGroup.getBoundingClientRect().width,
        rightWidth: rightGroup.getBoundingClientRect().width
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    };

  const focusEditorGroup = useCallback((groupId: string) => {
    setActiveEditorGroupId(groupId);
    activeEditorGroupIdRef.current = groupId;
    editorRef.current = editorRefsRef.current.get(groupId) ?? editorRef.current;
    diffEditorRef.current = diffEditorRefsRef.current.get(groupId) ?? diffEditorRef.current;
  }, []);

  const openTabInEditorGroup = useCallback(
    (tabId: string, groupId = activeEditorGroupId) => {
      setActiveWorkbenchTab("code");
      setActiveEditorGroupId(groupId);
      activeEditorGroupIdRef.current = groupId;
      setEditorGroups((state) =>
        state.map((group) => {
          if (group.id !== groupId) {
            return group;
          }

          const tabIds = group.tabIds.includes(tabId) ? group.tabIds : [...group.tabIds, tabId];
          return { ...group, tabIds, activeTabId: tabId };
        })
      );
    },
    [activeEditorGroupId]
  );

  const focusLine = (path: string, lineNumber?: number, groupId = activeEditorGroupId) => {
    setActiveWorkbenchTab("code");
    openTabInEditorGroup(path, groupId);
    setActivePath(path);

    window.requestAnimationFrame(() => {
      const editor = editorRefsRef.current.get(groupId) ?? editorRef.current;
      if (!editor || !lineNumber) {
        return;
      }

      editor.focus();
      editor.revealLineInCenter(lineNumber);
      editor.setPosition({ lineNumber, column: 1 });
    });
  };

  const openDiffTab = (targetPath: string, groupId = activeEditorGroupId) => {
    const diffTabId = createDiffTabId(targetPath);

    setActiveWorkbenchTab("code");
    openTabInEditorGroup(diffTabId, groupId);
    setSelection("", null);
    setSuggestion(null);
    setAiMode("chat");

    // diff 좌(원본) / 우(worktree) 모두 lazy content fetch — 백엔드 /files API 는
    // 트리 메타만 주고 content 는 GET /files/{fileId} / /worktrees/{id} 별도라서,
    // 이 보장 없이 diff 탭을 열면 한쪽이 빈 파일로 보임.
    const sourcePath = getWorktreeSourcePath(targetPath);
    void ensureBackendFileContent(sourcePath);
    void ensureBackendFileContent(targetPath);
  };

  const splitActiveEditorGroup = useCallback((sourceGroupId = activeEditorGroupId, sourceTabId = activeTabId) => {
    if (!sourceTabId || editorGroups.length >= MAX_EDITOR_GROUPS) {
      return;
    }

    const nextGroupId = `editor-group-${Date.now()}`;

    setEditorGroups((state) => {
      const activeIndex = Math.max(0, state.findIndex((group) => group.id === sourceGroupId));
      const nextGroup: EditorGroupState = { id: nextGroupId, tabIds: [sourceTabId], activeTabId: sourceTabId };
      const next = [...state];
      next.splice(activeIndex + 1, 0, nextGroup);
      return next;
    });

    setActiveEditorGroupId(nextGroupId);
    activeEditorGroupIdRef.current = nextGroupId;
    setActiveWorkbenchTab("code");
  }, [activeEditorGroupId, activeTabId, editorGroups.length]);

  const closeEditorGroup = useCallback(
    (groupId: string) => {
      if (editorGroups.length <= 1) {
        return;
      }

      setEditorGroups((state) => {
        if (state.length <= 1) {
          return state;
        }

        const closedIndex = state.findIndex((group) => group.id === groupId);
        const closedGroup = state[closedIndex];
        if (!closedGroup) {
          return state;
        }

        const next = state.filter((group) => group.id !== groupId);
        const fallbackIndex = Math.max(0, Math.min(closedIndex, next.length - 1));
        const fallbackGroup = next[fallbackIndex] ?? next[0];
        const closingActiveGroup = activeEditorGroupIdRef.current === groupId;

        if (closingActiveGroup && fallbackGroup) {
          setActiveEditorGroupId(fallbackGroup.id);
          activeEditorGroupIdRef.current = fallbackGroup.id;
          setActiveWorkbenchTab("code");
        }

        if (!fallbackGroup || !closedGroup.tabIds.length) {
          return next;
        }

        const closedActiveTabId =
          closedGroup.activeTabId && closedGroup.tabIds.includes(closedGroup.activeTabId)
            ? closedGroup.activeTabId
            : closedGroup.tabIds[0] ?? null;

        return next.map((group) => {
          if (group.id !== fallbackGroup.id) {
            return group;
          }

          const tabIds = [...group.tabIds];
          closedGroup.tabIds.forEach((tabId) => {
            if (!tabIds.includes(tabId)) {
              tabIds.push(tabId);
            }
          });

          const activeTabId =
            closingActiveGroup && closedActiveTabId && tabIds.includes(closedActiveTabId)
              ? closedActiveTabId
              : group.activeTabId && tabIds.includes(group.activeTabId)
                ? group.activeTabId
                : tabIds[0] ?? null;

          return { ...group, tabIds, activeTabId };
        });
      });
    },
    [editorGroups.length]
  );

  const handleOpenCodeWorkbench = () => {
    setActiveWorkbenchTab("code");
  };

  const handleActivityClick = (view: SidebarView) => {
    handleOpenCodeWorkbench();

    if (sidebarView === view && sidebarOpen) {
      setSidebarOpen(false);
      return;
    }

    setSidebarView(view);
  };

  const tutorialFirstVisitFiredRef = useRef(false);
  useEffect(() => {
    if (tutorialFirstVisitFiredRef.current) return;
    if (typeof window === "undefined") return;
    tutorialFirstVisitFiredRef.current = true;
    try {
      const seen = window.localStorage.getItem(TUTORIAL_FIRST_VISIT_KEY);
      if (seen) return;
      window.localStorage.setItem(TUTORIAL_FIRST_VISIT_KEY, "1");
      addToast("처음이신가요? 왼쪽 ? 아이콘으로 IDE 투어를 시작할 수 있습니다.", "info");
    } catch {
      /* noop */
    }
  }, [addToast]);

  const currentTourStep = tourActive ? tutorialSteps[tourStepIndex] ?? null : null;

  useEffect(() => {
    if (!tourActive) return;
    const step = tutorialSteps[tourStepIndex];
    if (!step?.action) return;
    const intent = step.action.intent;
    switch (intent.type) {
      case "openProblem":
        setActiveWorkbenchTab("problem");
        break;
      case "openTrace":
        setActiveWorkbenchTab("trace");
        break;
      case "openSidebar":
        setActiveWorkbenchTab("code");
        setSidebarView(intent.view);
        setSidebarOpen(true);
        break;
      case "toggleBottomPanel":
        setActiveWorkbenchTab("code");
        setBottomPanelOpen(true);
        break;
      case "toggleAi":
        setActiveWorkbenchTab("code");
        setAiOpen(true);
        break;
      case "scrollToTopBar":
        break;
    }
  // Intentionally narrow deps so the action fires only when the tour step changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourActive, tourStepIndex]);

  useEffect(() => {
    if (!tourActive) {
      setTourTargetRects([]);
      return;
    }
    const step = tutorialSteps[tourStepIndex];
    if (!step?.targetSelector) {
      setTourTargetRects([]);
      return;
    }
    const selectors = Array.isArray(step.targetSelector) ? step.targetSelector : [step.targetSelector];

    const measure = () => {
      const rects = selectors
        .map((selector) => {
          const el = document.querySelector(selector);
          if (!el) return null;
          const rect = el.getBoundingClientRect();
          return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
        })
        .filter((rect): rect is { top: number; left: number; width: number; height: number } => rect !== null);
      setTourTargetRects(rects);
    };

    measure();
    const id1 = window.setTimeout(measure, 50);
    const id2 = window.setTimeout(measure, 200);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.clearTimeout(id1);
      window.clearTimeout(id2);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [tourActive, tourStepIndex]);

  const closeTour = () => {
    setTourActive(false);
    setTourStepIndex(0);
  };

  const advanceTour = () => {
    const step = tutorialSteps[tourStepIndex];
    if (step) {
      setCompletedTutorialSteps((current) => {
        if (current.has(step.id)) return current;
        const next = new Set(current);
        next.add(step.id);
        try {
          window.localStorage.setItem(TUTORIAL_PROGRESS_KEY, JSON.stringify(Array.from(next)));
        } catch {}
        return next;
      });
    }
    if (tourStepIndex >= tutorialSteps.length - 1) {
      closeTour();
      return;
    }
    setTourStepIndex((idx) => idx + 1);
  };

  const retreatTour = () => {
    if (tourStepIndex <= 0) return;
    setTourStepIndex((idx) => idx - 1);
  };

  const performTourAction = (step: TutorialStep) => {
    if (!step.action) return;
    const intent = step.action.intent;
    switch (intent.type) {
      case "openProblem":
        handleOpenProblemTab();
        break;
      case "openTrace":
        setActiveWorkbenchTab("trace");
        break;
      case "openSidebar":
        handleOpenCodeWorkbench();
        setSidebarView(intent.view);
        setSidebarOpen(true);
        break;
      case "toggleBottomPanel":
        handleOpenCodeWorkbench();
        if (!showBottomPanel) handleToggleBottomPanel();
        break;
      case "toggleAi":
        handleOpenCodeWorkbench();
        if (!aiOpen) handleToggleAiPanel();
        break;
      case "scrollToTopBar":
        break;
    }
  };

  const handleToggleSidebarPanel = () => {
    handleOpenCodeWorkbench();
    setSidebarOpen(!sidebarOpen);
  };

  const handleToggleBottomPanel = () => {
    handleOpenCodeWorkbench();
    setBottomPanelOpen(!bottomPanelOpen);
  };

  const handleToggleAiPanel = () => {
    handleOpenCodeWorkbench();
    toggleAiOpen();
  };

  const refreshSession = () => {
    void queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
  };

  const hasDirtyDescendant = useCallback(
    (path: string | null) => {
      if (!path) {
        return false;
      }

      return unsavedPaths.some((item) => item === path || item.startsWith(`${path}/`));
    },
    [unsavedPaths]
  );

  const closeTabImmediate = useCallback(
    (tabId: string, groupId = activeEditorGroupId) => {
      setEditorGroups((state) =>
        state.map((group) => {
          if (group.id !== groupId) {
            return group;
          }

          const currentIndex = group.tabIds.indexOf(tabId);
          const nextTabIds = group.tabIds.filter((item) => item !== tabId);
          const fallback =
            group.activeTabId === tabId
              ? nextTabIds[currentIndex] ?? nextTabIds[currentIndex - 1] ?? nextTabIds[0] ?? null
              : group.activeTabId;

          if (group.activeTabId === tabId && !fallback && activeEditorGroupIdRef.current === groupId) {
            setSelection("", null);
            setSuggestion(null);
          }

          return { ...group, tabIds: nextTabIds, activeTabId: fallback };
        })
      );
      setActiveWorkbenchTab("code");
    },
    [activeEditorGroupId, setSelection, setSuggestion]
  );

  const savePaths = useCallback(
    async (paths: string[]) => {
      const uniquePaths = [...new Set(paths.filter(Boolean))];
      if (!uniquePaths.length) {
        return true;
      }

      const targetFiles = uniquePaths
        .map((path) => files.find((file) => file.path === path))
        .filter((file): file is WorkspaceFile => Boolean(file));

      if (!targetFiles.length) {
        return true;
      }

      setSaving(true);
      try {
        const results = await Promise.allSettled(
          targetFiles.map((file) =>
            isBackendSessionId(sessionId)
              ? sessionApi.saveFile(sessionId, {
                  path: file.path,
                  content: file.content,
                  language: file.language
                })
              : mockApi.saveFile(sessionId, file.path, file.content)
          )
        );

        const savedAt = new Date().toISOString();
        const failedFiles: Array<{ name: string; reason: string }> = [];

        results.forEach((result, i) => {
          const file = targetFiles[i];
          if (result.status === "fulfilled") {
            markSaved(file.path, savedAt);
          } else {
            failedFiles.push({
              name: file.path.split("/").pop() ?? file.path,
              reason: result.reason instanceof Error ? result.reason.message : "저장 실패"
            });
          }
        });

        if (failedFiles.length > 0) {
          const names = failedFiles.map((f) => f.name).join(", ");
          const detail = failedFiles.length === 1 ? ` — ${failedFiles[0].reason}` : "";
          addToast(
            failedFiles.length === 1
              ? `저장 실패: ${names}${detail}`
              : `${failedFiles.length}개 파일 저장 실패: ${names}`,
            "error"
          );
          return false;
        }

        refreshSession();
        return true;
      } finally {
        setSaving(false);
      }
    },
    [addToast, files, markSaved, sessionId]
  );

  const saveActiveFile = useCallback(async () => {
    if (!activeFile || activeTab?.kind !== "file") {
      return false;
    }

    return savePaths([activeFile.path]);
  }, [activeFile, activeTab?.kind, savePaths]);

  const saveAllDirtyFiles = useCallback(async () => {
    return savePaths(unsavedPaths);
  }, [savePaths, unsavedPaths]);

  const toggleExplorerSection = (key: ExplorerSectionKey) => {
    setExplorerSections((state) => ({
      ...state,
      [key]: !state[key]
    }));
  };

  const handleOpenProblemTab = () => {
    setActiveWorkbenchTab("problem");
  };

  const handleIdeContextMenu = useCallback((event: ReactMouseEvent<HTMLElement>) => {
    event.preventDefault();
  }, []);

  const openExplorerContextMenu = useCallback(
    (
      event: ReactMouseEvent<HTMLElement>,
      target: { parentPath: string | null; targetPath: string | null; targetKind: "root" | "folder" | "file" }
    ) => {
      event.preventDefault();
      event.stopPropagation();
      setExplorerContextMenu({
        x: event.clientX,
        y: event.clientY,
        parentPath: target.parentPath,
        targetPath: target.targetPath,
        targetKind: target.targetKind
      });
    },
    []
  );

  const beginExplorerCreate = useCallback(
    (kind: "file" | "folder", parentPath: string | null) => {
      setExplorerContextMenu(null);
      setExplorerCreateDraft({ kind, parentPath, value: "" });

      if (parentPath) {
        setCollapsedFolders((prev) => {
          if (!prev.has(parentPath)) {
            return prev;
          }

          const next = new Set(prev);
          next.delete(parentPath);
          return next;
        });
      }
    },
    []
  );

  const cancelExplorerCreate = useCallback(() => {
    setExplorerCreateDraft(null);
  }, []);

  const beginExplorerRename = useCallback(() => {
    if (!explorerContextMenu?.targetPath || explorerContextMenu.targetKind === "root") {
      return;
    }

    setExplorerContextMenu(null);
    setExplorerRenameDraft({
      targetPath: explorerContextMenu.targetPath,
      targetKind: explorerContextMenu.targetKind,
      parentPath:
        explorerContextMenu.targetKind === "folder"
          ? getFolderPath(explorerContextMenu.targetPath) || null
          : explorerContextMenu.parentPath,
      value: getFileName(explorerContextMenu.targetPath)
    });
  }, [explorerContextMenu]);

  const cancelExplorerRename = useCallback(() => {
    setExplorerRenameDraft(null);
  }, []);

  const commitExplorerCreate = useCallback(async () => {
    if (!explorerCreateDraft) {
      return;
    }

    const rawName = explorerCreateDraft.value.trim().replace(/^\/+|\/+$/g, "");
    if (!rawName) {
      setExplorerCreateDraft(null);
      return;
    }

    const nextPath = explorerCreateDraft.parentPath ? `${explorerCreateDraft.parentPath}/${rawName}` : rawName;

    if (explorerCreateDraft.kind === "folder") {
      setLocalFolders((state) => (state.includes(nextPath) ? state : [...state, nextPath]));
      setExplorerCreateDraft(null);
      addToast(`폴더 '${rawName}' 생성 준비 완료`, "success");
      return;
    }

    if (files.some((file) => file.path === nextPath)) {
      addToast("같은 이름의 파일이 이미 있습니다.", "warning");
      return;
    }

    const nextLanguage = inferLanguageFromPath(nextPath);

    if (isBackendSessionId(sessionId)) {
      // agent/* 경로는 SessionHarnessFile — 별도 endpoint (POST /sessions/{id}/harness).
      // 그 외는 일반 SessionFile (POST /sessions/{id}/files).
      const isHarnessPath = nextPath.startsWith("agent/");

      if (isHarnessPath) {
        // 백엔드 HarnessFileType enum: MARKDOWN / TOML / YAML 만 지원
        const ext = rawName.toLowerCase().split(".").pop();
        const fileTypeMap: Record<string, "MARKDOWN" | "TOML" | "YAML"> = {
          md: "MARKDOWN",
          markdown: "MARKDOWN",
          toml: "TOML",
          yaml: "YAML",
          yml: "YAML"
        };
        const fileType = ext ? fileTypeMap[ext] : undefined;
        if (!fileType) {
          addToast("하네스 파일은 .md / .toml / .yaml 만 만들 수 있어요.", "warning");
          return;
        }

        try {
          // 백엔드는 agent/ prefix 없이 raw path 저장 — 매핑은 응답 재조회 시 frontend 가 다시 prefix 붙임
          const backendPath = nextPath.slice("agent/".length);
          await sessionApi.addHarnessFile(sessionId, {
            path: backendPath,
            name: rawName,
            nodeType: "FILE",
            fileType,
            content: ""
          });
          await queryClient.invalidateQueries({ queryKey: ["workspace", sessionId] });
          openTabInEditorGroup(nextPath);
          setActivePath(nextPath);
          setExplorerCreateDraft(null);
          addToast(`하네스 파일 '${rawName}'을 생성했어요.`, "success");
          return;
        } catch (error) {
          addToast(error instanceof Error ? error.message : "하네스 파일 생성에 실패했습니다.", "error");
          return;
        }
      }

      try {
        const workspaceResult = await sessionApi.createFile(sessionId, {
          path: nextPath,
          nodeType: "FILE",
          language: nextLanguage,
          content: ""
        });

        setWorkspace(workspaceResult.files, nextPath);
        openTabInEditorGroup(nextPath);
        setActivePath(nextPath);
        setExplorerCreateDraft(null);
        void queryClient.invalidateQueries({ queryKey: ["workspace", sessionId] });
        void queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
        addToast(`파일 '${rawName}'을 생성했어요.`, "success");
        return;
      } catch (error) {
        addToast(error instanceof Error ? error.message : "파일 생성에 실패했습니다.", "error");
        return;
      }
    }

    createWorkspaceFile(
      {
        path: nextPath,
        language: nextLanguage,
        content: ""
      },
      true
    );
    openTabInEditorGroup(nextPath);
    setActivePath(nextPath);
    setExplorerCreateDraft(null);
    addToast(`파일 '${rawName}' 생성 준비 완료`, "success");
  }, [addToast, createWorkspaceFile, explorerCreateDraft, files, openTabInEditorGroup, queryClient, sessionId, setActivePath, setWorkspace]);

  const commitExplorerRename = useCallback(async () => {
    if (!explorerRenameDraft) {
      return;
    }

    const rawName = explorerRenameDraft.value.trim().replace(/^\/+|\/+$/g, "");
    if (!rawName) {
      setExplorerRenameDraft(null);
      return;
    }

    const nextPath = explorerRenameDraft.parentPath ? `${explorerRenameDraft.parentPath}/${rawName}` : rawName;

    if (nextPath === explorerRenameDraft.targetPath) {
      setExplorerRenameDraft(null);
      return;
    }

    if (explorerRenameDraft.targetKind === "file") {
      if (files.some((file) => file.path === nextPath)) {
        addToast("같은 이름의 파일이 이미 있습니다.", "warning");
        return;
      }

      // 백엔드 세션이면 PATCH path 호출 후 store 갱신. 실패 시 store 손대지 않음.
      if (isBackendSessionId(sessionId)) {
        try {
          await sessionApi.moveFile(sessionId, explorerRenameDraft.targetPath, nextPath);
        } catch (error) {
          addToast(error instanceof Error ? error.message : "파일 이름 변경에 실패했습니다.", "error");
          return;
        }
      }

      setLocalFolders((state) => appendLocalFolder(state, getFolderPath(explorerRenameDraft.targetPath) || null));
      renameWorkspaceFile(explorerRenameDraft.targetPath, nextPath);
      setEditorGroups((state) =>
        state.map((group) => ({
          ...group,
          tabIds: group.tabIds.map((path) => (path === explorerRenameDraft.targetPath ? nextPath : path)),
          activeTabId: group.activeTabId === explorerRenameDraft.targetPath ? nextPath : group.activeTabId
        }))
      );
      setExplorerRenameDraft(null);
      addToast(`파일 이름을 '${rawName}'로 변경했어요.`, "success");
      if (isBackendSessionId(sessionId)) {
        void queryClient.invalidateQueries({ queryKey: ["workspace", sessionId] });
      }
      return;
    }

    if (
      localFolders.some(
        (folder) => folder !== explorerRenameDraft.targetPath && (folder === nextPath || folder.startsWith(`${nextPath}/`))
      )
    ) {
      addToast("같은 이름의 폴더가 이미 있습니다.", "warning");
      return;
    }

    // 폴더 rename — 안의 모든 파일 일괄 PATCH
    const folderFiles = files.filter((file) => file.path.startsWith(`${explorerRenameDraft.targetPath}/`));
    if (isBackendSessionId(sessionId) && folderFiles.length > 0) {
      try {
        await Promise.all(
          folderFiles.map((file) =>
            sessionApi.moveFile(sessionId, file.path, replacePathPrefix(file.path, explorerRenameDraft.targetPath, nextPath))
          )
        );
      } catch (error) {
        addToast(error instanceof Error ? error.message : "폴더 이름 변경에 실패했습니다.", "error");
        return;
      }
    }

    setLocalFolders((state) => state.map((folder) => replacePathPrefix(folder, explorerRenameDraft.targetPath, nextPath)));
    folderFiles.forEach((file) => {
      renameWorkspaceFile(file.path, replacePathPrefix(file.path, explorerRenameDraft.targetPath, nextPath));
    });
    setEditorGroups((state) =>
      state.map((group) => ({
        ...group,
        tabIds: group.tabIds.map((path) => replacePathPrefix(path, explorerRenameDraft.targetPath, nextPath)),
        activeTabId: group.activeTabId ? replacePathPrefix(group.activeTabId, explorerRenameDraft.targetPath, nextPath) : null
      }))
    );
    setExplorerRenameDraft(null);
    addToast(`폴더 이름을 '${rawName}'로 변경했어요.`, "success");
    if (isBackendSessionId(sessionId)) {
      void queryClient.invalidateQueries({ queryKey: ["workspace", sessionId] });
    }
  }, [addToast, explorerRenameDraft, files, localFolders, queryClient, renameWorkspaceFile, sessionId]);

  const handleExplorerDelete = useCallback(async () => {
    if (!explorerContextMenu?.targetPath || explorerContextMenu.targetKind === "root") {
      return;
    }

    const targetPath = explorerContextMenu.targetPath;
    const targetKind = explorerContextMenu.targetKind;
    setExplorerContextMenu(null);

    // dirty 가 있으면 confirm (#9).
    const dirtyPaths =
      targetKind === "file"
        ? unsavedPaths.filter((p) => p === targetPath)
        : unsavedPaths.filter((p) => p === targetPath || p.startsWith(`${targetPath}/`));
    if (dirtyPaths.length > 0) {
      const message =
        targetKind === "file"
          ? `'${getFileName(targetPath)}' 에 저장되지 않은 변경이 있습니다. 그대로 삭제할까요?`
          : `'${getFileName(targetPath)}' 안에 저장되지 않은 변경이 ${dirtyPaths.length}개 있습니다. 그대로 삭제할까요?`;
      if (!window.confirm(message)) {
        return;
      }
    }

    // 삭제할 파일 path 목록 — 파일 1개 또는 폴더 안 모든 파일.
    const pathsToDelete =
      targetKind === "file"
        ? [targetPath]
        : files.filter((file) => file.path.startsWith(`${targetPath}/`)).map((file) => file.path);

    // 백엔드 세션이면 실제 DELETE 요청. mock 세션은 store 만 갱신 (기존 흐름).
    if (isBackendSessionId(sessionId) && pathsToDelete.length > 0) {
      try {
        await Promise.all(pathsToDelete.map((p) => sessionApi.deleteFile(sessionId, p)));
      } catch (error) {
        addToast(error instanceof Error ? error.message : "파일 삭제에 실패했습니다.", "error");
        // 백엔드 실패 시 store 손대지 않고 종료 — 다음 새로고침에 정합 회복.
        return;
      }
    }

    // 백엔드 성공 (또는 mock) → 로컬 store 갱신
    if (targetKind === "file") {
      setLocalFolders((state) => appendLocalFolder(state, getFolderPath(targetPath) || null));
      removeWorkspaceFile(targetPath);
      setEditorGroups((state) =>
        state.map((group) => {
          const tabIds = group.tabIds.filter((path) => path !== targetPath);
          return {
            ...group,
            tabIds,
            activeTabId: group.activeTabId === targetPath ? tabIds[0] ?? null : group.activeTabId
          };
        })
      );
      addToast(`파일 '${getFileName(targetPath)}'을 삭제했어요.`, "success");
    } else {
      setLocalFolders((state) => state.filter((folder) => folder !== targetPath && !folder.startsWith(`${targetPath}/`)));
      pathsToDelete.forEach((p) => removeWorkspaceFile(p));
      setEditorGroups((state) =>
        state.map((group) => {
          const tabIds = group.tabIds.filter((path) => !path.startsWith(`${targetPath}/`));
          return {
            ...group,
            tabIds,
            activeTabId: group.activeTabId && group.activeTabId.startsWith(`${targetPath}/`) ? tabIds[0] ?? null : group.activeTabId
          };
        })
      );
      addToast(`폴더 '${getFileName(targetPath)}'을 삭제했어요.`, "success");
    }

    // workspace 새로고침 — 백엔드 응답으로 fileId 매핑 갱신
    if (isBackendSessionId(sessionId)) {
      void queryClient.invalidateQueries({ queryKey: ["workspace", sessionId] });
    }
  }, [addToast, explorerContextMenu, files, queryClient, removeWorkspaceFile, sessionId, unsavedPaths]);

  const handleExplorerFileDragStart = useCallback((event: ReactDragEvent<HTMLElement>, path: string) => {
    event.stopPropagation();
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", path);
    setDraggedExplorerPath(path);
    setFolderDropTargetPath(null);
  }, []);

  const handleExplorerFolderDragOver = useCallback(
    (event: ReactDragEvent<HTMLElement>, targetFolderPath: string) => {
      const sourcePath = draggedExplorerPath || event.dataTransfer.getData("text/plain");
      if (!sourcePath || sourcePath === targetFolderPath || getFolderPath(sourcePath) === targetFolderPath) {
        return;
      }

      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setFolderDropTargetPath((current) => (current === targetFolderPath ? current : targetFolderPath));
    },
    [draggedExplorerPath]
  );

  const clearExplorerDragState = useCallback(() => {
    setDraggedExplorerPath(null);
    setFolderDropTargetPath(null);
  }, []);

  const handleExplorerFolderDrop = useCallback(
    async (event: ReactDragEvent<HTMLElement>, targetFolderPath: string) => {
      event.preventDefault();
      const sourcePath = draggedExplorerPath || event.dataTransfer.getData("text/plain");
      clearExplorerDragState();

      if (!sourcePath || getFolderPath(sourcePath) === targetFolderPath) {
        return;
      }

      const file = files.find((item) => item.path === sourcePath);
      if (!file) {
        return;
      }

      const nextPath = `${targetFolderPath}/${getFileName(sourcePath)}`;
      if (files.some((item) => item.path === nextPath)) {
        addToast("같은 이름의 파일이 이미 있어 이동할 수 없어요.", "warning");
        return;
      }

      // 백엔드 세션이면 PATCH path 호출. 실패 시 store 손대지 않음.
      if (isBackendSessionId(sessionId)) {
        try {
          await sessionApi.moveFile(sessionId, sourcePath, nextPath);
        } catch (error) {
          addToast(error instanceof Error ? error.message : "파일 이동에 실패했습니다.", "error");
          return;
        }
      }

      setLocalFolders((state) => appendLocalFolder(state, getFolderPath(sourcePath) || null));
      renameWorkspaceFile(sourcePath, nextPath);
      setEditorGroups((state) =>
        state.map((group) => ({
          ...group,
          tabIds: group.tabIds.map((path) => (path === sourcePath ? nextPath : path)),
          activeTabId: group.activeTabId === sourcePath ? nextPath : group.activeTabId
        }))
      );
      addToast(`파일을 '${getFileName(targetFolderPath)}' 폴더로 이동했어요.`, "success");
      if (isBackendSessionId(sessionId)) {
        void queryClient.invalidateQueries({ queryKey: ["workspace", sessionId] });
      }
    },
    [addToast, clearExplorerDragState, draggedExplorerPath, files, queryClient, renameWorkspaceFile, sessionId]
  );

  const handleCloseFileTab = (tabId: string, groupId = activeEditorGroupId) => {
    const targetTab = openTabs.find((tab) => tab.id === tabId);
    if (!targetTab) {
      return;
    }

    if (targetTab.kind === "file" && unsavedPaths.includes(targetTab.path)) {
      setSavePromptAction({ type: "close-tab", groupId, tabId, path: targetTab.path });
      setSavePromptOpen(true);
      return;
    }

    closeTabImmediate(tabId, groupId);
  };

  const clearTabDragState = useCallback(() => {
    setDraggedTabId(null);
    setDraggedTabSourceGroupId(null);
    setTabDropHint(null);
  }, []);

  const handleTabDragStart = useCallback((event: ReactDragEvent<HTMLDivElement>, tabId: string, groupId: string) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", tabId);
    setDraggedTabId(tabId);
    setDraggedTabSourceGroupId(groupId);
    setTabDropHint(null);
  }, []);

  const handleTabDragOver = useCallback(
    (event: ReactDragEvent<HTMLDivElement>, targetId: string) => {
      if (!draggedTabId || draggedTabId === targetId) {
        return;
      }

      event.preventDefault();
      event.dataTransfer.dropEffect = "move";

      const bounds = event.currentTarget.getBoundingClientRect();
      const position = event.clientX - bounds.left > bounds.width / 2 ? "after" : "before";

      setTabDropHint((current) =>
        current?.targetId === targetId && current.position === position ? current : { targetId, position }
      );
    },
    [draggedTabId]
  );

  const handleTabDrop = useCallback(
    (event: ReactDragEvent<HTMLDivElement>, targetId: string, groupId = activeEditorGroupId) => {
      event.preventDefault();
      event.stopPropagation();

      const sourceId = draggedTabId || event.dataTransfer.getData("text/plain");
      if (!sourceId || sourceId === targetId || !tabDropHint || tabDropHint.targetId !== targetId) {
        clearTabDragState();
        return;
      }

      setEditorGroups((state) => {
        const withoutSource = state.map((group) => {
          if (draggedTabSourceGroupId ? group.id !== draggedTabSourceGroupId : !group.tabIds.includes(sourceId)) {
            return group;
          }

          const tabIds = group.tabIds.filter((tabId) => tabId !== sourceId);
          return {
            ...group,
            tabIds,
            activeTabId: group.activeTabId === sourceId ? tabIds[0] ?? null : group.activeTabId
          };
        });

        return withoutSource.map((group) => {
          if (group.id !== groupId) {
            return group;
          }

          const tabIds = group.tabIds.includes(sourceId) ? group.tabIds : [...group.tabIds, sourceId];
          return {
            ...group,
            tabIds: reorderItems(tabIds, sourceId, targetId, tabDropHint.position),
            activeTabId: sourceId
          };
        });
      });
      focusEditorGroup(groupId);
      clearTabDragState();
    },
    [activeEditorGroupId, clearTabDragState, draggedTabId, draggedTabSourceGroupId, focusEditorGroup, tabDropHint]
  );

  const handleTabDropToGroup = useCallback(
    (event: ReactDragEvent<HTMLElement>, groupId: string) => {
      const sourceId = draggedTabId || event.dataTransfer.getData("text/plain");
      if (!sourceId || !tabsById.has(sourceId)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      setEditorGroups((state) => {
        const withoutSource = state.map((group) => {
          if (draggedTabSourceGroupId ? group.id !== draggedTabSourceGroupId : !group.tabIds.includes(sourceId)) {
            return group;
          }

          const tabIds = group.tabIds.filter((tabId) => tabId !== sourceId);
          return {
            ...group,
            tabIds,
            activeTabId: group.activeTabId === sourceId ? tabIds[0] ?? null : group.activeTabId
          };
        });

        return withoutSource.map((group) => {
          if (group.id !== groupId) {
            return group;
          }

          const tabIds = group.tabIds.includes(sourceId) ? group.tabIds : [...group.tabIds, sourceId];
          return { ...group, tabIds, activeTabId: sourceId };
        });
      });

      focusEditorGroup(groupId);
      clearTabDragState();
    },
    [clearTabDragState, draggedTabId, draggedTabSourceGroupId, focusEditorGroup, tabsById]
  );

  const handleTabDragOverGroup = useCallback(
    (event: ReactDragEvent<HTMLElement>) => {
      const sourceId = draggedTabId || event.dataTransfer.getData("text/plain");
      if (!sourceId || !tabsById.has(sourceId)) {
        return;
      }

      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    },
    [draggedTabId, tabsById]
  );

  const handleTabSplitDragOver = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      const sourceId = draggedTabId || event.dataTransfer.getData("text/plain");
      if (!sourceId || !tabsById.has(sourceId) || editorGroups.length >= MAX_EDITOR_GROUPS) {
        return;
      }

      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    },
    [draggedTabId, editorGroups.length, tabsById]
  );

  const handleTabSplitDrop = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      const sourceId = draggedTabId || event.dataTransfer.getData("text/plain");
      if (!sourceId || !tabsById.has(sourceId) || editorGroups.length >= MAX_EDITOR_GROUPS) {
        clearTabDragState();
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const nextGroupId = `editor-group-${Date.now()}`;

      setEditorGroups((state) => {
        if (state.length >= MAX_EDITOR_GROUPS) {
          return state;
        }

        const sourceGroupId =
          draggedTabSourceGroupId ??
          state.find((group) => group.tabIds.includes(sourceId))?.id ??
          activeEditorGroupId;
        const sourceIndex = Math.max(0, state.findIndex((group) => group.id === sourceGroupId));
        const nextGroup: EditorGroupState = { id: nextGroupId, tabIds: [sourceId], activeTabId: sourceId };
        const withoutSource = state.map((group) => {
          if (group.id !== sourceGroupId) {
            return group;
          }

          const tabIds = group.tabIds.filter((tabId) => tabId !== sourceId);
          return {
            ...group,
            tabIds,
            activeTabId: group.activeTabId === sourceId ? tabIds[0] ?? null : group.activeTabId
          };
        });
        const next = [...withoutSource];
        next.splice(sourceIndex + 1, 0, nextGroup);
        return next;
      });

      setActiveEditorGroupId(nextGroupId);
      activeEditorGroupIdRef.current = nextGroupId;
      setActiveWorkbenchTab("code");
      clearTabDragState();
    },
    [
      activeEditorGroupId,
      clearTabDragState,
      draggedTabId,
      draggedTabSourceGroupId,
      editorGroups.length,
      tabsById
    ]
  );

  const handleTabDragEnd = useCallback(() => {
    clearTabDragState();
  }, [clearTabDragState]);

  const handleRequestEdit = async () => {
    if (!selectedCode) {
      addToast("먼저 에디터에서 코드를 선택하세요.", "warning");
      return;
    }

    setEditLoading(true);
    try {
      const nextSuggestion = await mockApi.requestAiEdit(
        sessionId,
        activeFile.path,
        activeFile.content,
        selectedCode,
        editInstruction
      );
      setSuggestion(nextSuggestion);
      addToast("AI 수정 제안을 불러왔습니다.", "success");
    } catch (error) {
      addToast(error instanceof Error ? error.message : "AI 수정 요청에 실패했습니다.", "error");
    } finally {
      setEditLoading(false);
    }
  };

  /**
   * Worktree diff 탭의 [적용] / [거절] — 백엔드 partialEdit API.
   * - 적용: origin 파일을 worktree 내용으로 덮어쓰고 worktree 제거
   * - 거절: worktree만 제거 (origin 그대로)
   */
  const handlePartialEdit = useCallback(async (worktreePath: string, isApproved: boolean) => {
    if (!isBackendSessionId(sessionId)) {
      addToast("로컬 mock 세션에는 적용 동작이 없습니다.", "warning");
      return;
    }
    try {
      await sessionApi.partialEdit(sessionId, { worktreePath, isApproved });
      addToast(isApproved ? "AI 수정이 적용되었습니다." : "AI 수정 제안을 거절했습니다.", "success");

      // diff 탭 닫기 (탭 모델은 diff:<path>)
      const diffTabId = createDiffTabId(worktreePath);
      handleCloseFileTab(diffTabId, activeEditorGroupId);

      // React commit + Monaco unmount 사이 race 회피 — handleCloseFileTab 직후 곧바로
      // invalidate 하면 DiffEditor 가 새 props 받기 전에 model 이 disposed 돼 콘솔에
      // "TextModel got disposed before DiffEditorWidget model got reset" 에러 발생.
      // setTimeout(0) 한 번으로는 multi-edit 흐름에서 부족 — RAF 두 번 + setTimeout 으로 충분히
      // unmount 가 완료된 다음에 invalidate 트리거.
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => setTimeout(resolve, 16));
        });
      });

      // workspace 새로고침 — worktree 파일 사라지고, 적용한 경우 origin 파일 새 내용 hydrate
      await queryClient.invalidateQueries({ queryKey: ["workspace", sessionId] });
    } catch (error) {
      addToast(error instanceof Error ? error.message : "AI 수정 적용에 실패했습니다.", "error");
    }
  }, [activeEditorGroupId, addToast, handleCloseFileTab, queryClient, sessionId]);

  /**
   * 현재 세션의 모든 worktree 파일을 일괄 승인/거절 — 백엔드 allEdit API.
   * 현재 보고 있는 diff 탭 외에도 큐에 쌓인 다른 AI 수정 제안을 한 번에 처리할 때 사용.
   */
  const handleAllEdit = useCallback(async (isApproved: boolean) => {
    if (!isBackendSessionId(sessionId)) {
      addToast("로컬 mock 세션에는 적용 동작이 없습니다.", "warning");
      return;
    }
    const worktreePaths = files
      .filter((file) => file.path.startsWith(".worktree/"))
      .map((file) => file.path);
    if (worktreePaths.length === 0) {
      addToast("처리할 AI 수정이 없습니다.", "warning");
      return;
    }
    try {
      await sessionApi.allEdit(sessionId, { worktreePaths, isApproved });
      addToast(
        isApproved
          ? `AI 수정 ${worktreePaths.length}개를 모두 적용했습니다.`
          : `AI 수정 ${worktreePaths.length}개를 모두 거절했습니다.`,
        "success"
      );

      // 모든 diff 탭 닫기
      for (const path of worktreePaths) {
        const diffTabId = createDiffTabId(path);
        handleCloseFileTab(diffTabId, activeEditorGroupId);
      }

      // React commit yield — handlePartialEdit 와 동일 race 회피 (RAF 두 번 + setTimeout).
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => setTimeout(resolve, 16));
        });
      });

      await queryClient.invalidateQueries({ queryKey: ["workspace", sessionId] });
    } catch (error) {
      addToast(error instanceof Error ? error.message : "AI 수정 일괄 처리에 실패했습니다.", "error");
    }
  }, [activeEditorGroupId, addToast, files, handleCloseFileTab, queryClient, sessionId]);

  const handleApplyEdit = async () => {
    if (!editorRef.current || !selectedRange || !suggestion || !activeFile) {
      return;
    }

    const model = editorRef.current.getModel();
    if (!model) return;

    const lineCount = model.getLineCount();
    const clampedRange = {
      startLineNumber: Math.min(selectedRange.startLineNumber, lineCount),
      startColumn: selectedRange.startColumn,
      endLineNumber: Math.min(selectedRange.endLineNumber, lineCount),
      endColumn: selectedRange.endColumn
    };

    editorRef.current.executeEdits("ai-edit", [
      {
        range: clampedRange,
        text: suggestion.replacement
      }
    ]);

    const nextContent = model.getValue() ?? "";
    updateFileContent(activeFile.path, nextContent);
    await mockApi.applyAiEdit(sessionId, activeFile.path, nextContent, suggestion.summary);
    setSuggestion(null);
    setAiMode("chat");
    refreshSession();
    addToast("AI 제안을 에디터에 반영했습니다.", "success");
  };

  const executeEndSession = useCallback(async () => {
    if (endSessionLoading) {
      return;
    }

    setEndSessionLoading(true);
    try {
      if (isBackendSessionId(sessionId)) {
        await sessionApi.endSession(sessionId);
      }
      addToast("세션이 종료되었습니다.", "success");

      // 종료된 세션의 localStorage editor-layout snapshot cleanup (#10).
      try {
        window.localStorage.removeItem(getEditorLayoutStorageKey(sessionId));
      } catch {
        /* noop */
      }

      await queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
      await queryClient.invalidateQueries({ queryKey: ["sessions"] });
      router.push(withPrefix("/problems"));
    } catch (error) {
      addToast(error instanceof Error ? error.message : "세션 종료에 실패했습니다.", "error");
    } finally {
      setEndSessionLoading(false);
    }
  }, [addToast, endSessionLoading, queryClient, router, sessionId, withPrefix]);

  const handleEndSession = useCallback(() => {
    if (unsavedPaths.length) {
      setSavePromptAction({ type: "end-session" });
      setSavePromptOpen(true);
      return;
    }

    void executeEndSession();
  }, [executeEndSession, unsavedPaths.length]);

  const handleNavigateRequest = useCallback(
    (href: string) => {
      if (unsavedPaths.length) {
        setSavePromptAction({ type: "navigate", href });
        setSavePromptOpen(true);
        return;
      }

      router.push(href);
    },
    [router, unsavedPaths.length]
  );

  const handleSavePromptCancel = useCallback(() => {
    if (saving) {
      return;
    }

    setSavePromptOpen(false);
    setSavePromptAction(null);
  }, [saving]);

  const handleSavePromptDiscard = useCallback(async () => {
    if (!savePromptAction || saving) {
      return;
    }

    setSavePromptOpen(false);
    setSavePromptAction(null);

    if (savePromptAction.type === "close-tab") {
      discardFileChanges(savePromptAction.path);
      closeTabImmediate(savePromptAction.tabId, savePromptAction.groupId);
    } else if (savePromptAction.type === "navigate") {
      savedBackTargetRef.current = null;
      router.push(savePromptAction.href);
    } else {
      await executeEndSession();
    }
  }, [closeTabImmediate, discardFileChanges, executeEndSession, router, savePromptAction, saving]);

  const handleSavePromptSave = useCallback(async () => {
    if (!savePromptAction || saving) {
      return;
    }

    const pathsToSave = savePromptAction.type === "close-tab" ? [savePromptAction.path] : [...unsavedPaths];
    const didSave = await savePaths(pathsToSave);
    if (!didSave) {
      return;
    }

    setSavePromptOpen(false);
    setSavePromptAction(null);

    if (savePromptAction.type === "close-tab") {
      closeTabImmediate(savePromptAction.tabId, savePromptAction.groupId);
    } else if (savePromptAction.type === "navigate") {
      savedBackTargetRef.current = null;
      router.push(savePromptAction.href);
    } else {
      await executeEndSession();
    }
  }, [closeTabImmediate, executeEndSession, router, savePaths, savePromptAction, saving, unsavedPaths]);

  useEffect(() => {
    const handleWindowKeydown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveAllDirtyFiles();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveActiveFile();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key === "\\") {
        event.preventDefault();
        splitActiveEditorGroup();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && /^[1-3]$/.test(event.key)) {
        const group = editorGroups[Number(event.key) - 1];
        if (group) {
          event.preventDefault();
          focusEditorGroup(group.id);
        }
      }
    };

    window.addEventListener("keydown", handleWindowKeydown);
    return () => window.removeEventListener("keydown", handleWindowKeydown);
  }, [editorGroups, focusEditorGroup, saveActiveFile, saveAllDirtyFiles, splitActiveEditorGroup]);

  useEffect(() => {
    try {
      window.localStorage.setItem(AUTO_SAVE_STORAGE_KEY, autoSaveEnabled ? "1" : "0");
    } catch {
      // noop
    }
  }, [autoSaveEnabled]);

  // 30초 정주기 자동저장 — unsavedPaths/saving 을 ref 로 읽어 dep 에서 빼면 timer 가 reset 안 됨.
  // 이전엔 dirty 추가될 때마다 effect 재실행되어 timer 리셋 → 빠르게 편집 시 영원히 안 저장될 수 있음.
  const autoSaveStateRef = useRef({ unsavedPaths, saving });
  useEffect(() => {
    autoSaveStateRef.current = { unsavedPaths, saving };
  }, [unsavedPaths, saving]);

  useEffect(() => {
    if (!autoSaveEnabled) {
      return;
    }

    const timer = window.setInterval(() => {
      const { unsavedPaths: cur, saving: curSaving } = autoSaveStateRef.current;
      if (!cur.length || curSaving) {
        return;
      }
      void saveAllDirtyFiles();
    }, AUTO_SAVE_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [autoSaveEnabled, saveAllDirtyFiles]);

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (
        !unsavedPaths.length ||
        savePromptOpen ||
        saving ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }

      if (anchor.target === "_blank" || anchor.hasAttribute("download")) {
        return;
      }

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) {
        return;
      }

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) {
        return;
      }

      const nextHref = `${url.pathname}${url.search}${url.hash}`;
      const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (nextHref === currentHref) {
        return;
      }

      event.preventDefault();
      setSavePromptAction({ type: "navigate", href: nextHref });
      setSavePromptOpen(true);
    };

    document.addEventListener("click", handleDocumentClick, true);
    return () => document.removeEventListener("click", handleDocumentClick, true);
  }, [savePromptOpen, saving, unsavedPaths.length]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!unsavedPaths.length) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [unsavedPaths.length]);

  // Keep refs in sync so the persistent popstate handler always sees current values
  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  useEffect(() => {
    isDirtyRef.current = unsavedPaths.length > 0;
    if (!unsavedPaths.length) {
      savedBackTargetRef.current = null;
    }
  }, [unsavedPaths.length]);

  // Register popstate guard ONCE on mount. Uses refs so it never needs re-registration.
  useEffect(() => {
    const ideHref = window.location.pathname + window.location.search + window.location.hash;

    const showModal = (target: string) => {
      // flushSync forces React to render the modal synchronously before any
      // concurrent re-render (e.g. from Next.js router) can reset the state.
      flushSync(() => {
        setSavePromptAction({ type: "navigate", href: target });
        setSavePromptOpen(true);
      });
      // Belt-and-suspenders: if Next.js already started navigating despite
      // stopImmediatePropagation, replace back to the IDE page to cancel it.
      routerRef.current.replace(ideHref as any);
    };

    const handlePopState = (e: PopStateEvent) => {
      if (!isDirtyRef.current) {
        return;
      }

      if (allowNextPopStateRef.current) {
        allowNextPopStateRef.current = false;
        return;
      }

      const targetHref = window.location.pathname + window.location.search + window.location.hash;

      if (targetHref === ideHref) {
        // Back from a guard entry to the original ide entry (same URL).
        // Re-push guard so no extra press is ever needed.
        if (savedBackTargetRef.current) {
          e.stopImmediatePropagation();
          window.history.pushState(null, "", ideHref);
          showModal(savedBackTargetRef.current);
        }
        return;
      }

      // New back/forward navigation: block, restore URL, show modal.
      e.stopImmediatePropagation();
      window.history.pushState(null, "", ideHref);
      savedBackTargetRef.current = targetHref;
      showModal(targetHref);
    };

    window.addEventListener("popstate", handlePopState, true);
    return () => window.removeEventListener("popstate", handlePopState, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTest = async () => {
    // 동시성 가드 — 다른 실행이 돌고 있으면 거절
    if (testLoading || submitLoading || submissionLoading) {
      addToast("이미 실행 중인 작업이 있습니다. 끝난 뒤 다시 시도해 주세요.", "warning");
      return;
    }

    if (unsavedPaths.length) {
      const didSave = await savePaths([...unsavedPaths]);
      if (!didSave) {
        return;
      }
    }

    // 채점 진행 상태를 사용자가 보게끔 BottomTray "테스트" 탭으로 자동 포커스 + 시작 시각 stamp
    setBottomPanelTab("tests");
    setTestStartedAtMs(Date.now());
    setTestResult(null);  // 이전 결과 초기화 — RUNNING UI 가 깔끔히 뜨도록
    setTestLoading(true);
    try {
      if (isBackendSessionId(sessionId)) {
        const result = await sessionApi.runExecution(sessionId);
        setRunResult(result.runResult);
        setTestResult(result.testResult);
        addToast(
          result.raw.status === "COMPLETED"
            ? `공개 테스트 ${result.testResult.passed}/${result.testResult.total} 통과`
            : "테스트 실행이 실패했습니다. 출력 패널을 확인하세요.",
          result.raw.status === "COMPLETED" ? "success" : "error"
        );
      } else {
        const result = await mockApi.runTests(sessionId);
        setTestResult(result);
      }
      refreshSession();
    } catch (error) {
      addToast(error instanceof Error ? error.message : "테스트 실행에 실패했습니다.", "error");
    } finally {
      setTestLoading(false);
      setTestStartedAtMs(null);
    }
  };

  const handleSubmit = async () => {
    // 동시성 가드 — 다른 실행이 돌고 있으면 거절
    if (testLoading || submitLoading || submissionLoading) {
      addToast("이미 실행 중인 작업이 있습니다. 끝난 뒤 다시 시도해 주세요.", "warning");
      return;
    }
    setSubmitLoading(true);
    try {
      if (isBackendSessionId(sessionId)) {
        // 제출 후 별도 페이지로 라우팅하는 대신 IDE 안 BottomTray "제출" 탭에서 폴링/표시.
        // 라우팅을 끊은 이유:
        //   1) 백엔드에 리포트 생성 기능이 아직 미구현이라 "리포트가 준비됐어요" 라는 페이지가 거짓
        //   2) 제출은 한 세션에서 N번 가능 — 매번 페이지 이동하면 사용자 흐름이 끊김
        const { executionId } = await sessionApi.submitSession(sessionId);
        const idStr = String(executionId);

        // 새 제출 시작 — 이전 결과는 마지막 1개만 보여주는 모델이라 덮어쓰기.
        setSubmissionExecutionId(idStr);
        setSubmissionResult({
          executionId: idStr,
          rawStatus: "RUNNING",
          total: 0,
          passed: 0,
          failed: 0,
          passRate: 0,
          startedAt: Date.now(),
          endedAt: null
        });
        setSubmissionLoading(true);
        setBottomPanelTab("submission"); // 자동 포커스
        addToast("제출했습니다. 채점 결과를 기다리는 중입니다.", "success");
      } else {
        // mock 환경은 기존 페이지 흐름 유지 (백엔드 미연결 데모용).
        const submission = await mockApi.submitSession(sessionId);
        addToast("제출이 생성되었습니다.", "success");
        router.push(withPrefix(`/submissions/${submission.id}`));
      }
    } catch (error) {
      addToast(error instanceof Error ? error.message : "제출에 실패했습니다.", "error");
    } finally {
      setSubmitLoading(false);
    }
  };

  // 세션 export — 모든 파일 content + 메시지 + 메타데이터를 JSON 한 파일로 download.
  // zip 라이브러리 의존성 없이 단순. 사용자가 어디론가 백업하거나 다른 시스템으로 옮길 때.
  const handleExportSession = useCallback(() => {
    try {
      const payload = {
        sessionId,
        exportedAt: new Date().toISOString(),
        problem: {
          id: session?.problemId ?? null,
          title: problem?.title ?? null
        },
        files: files.map((f) => ({ path: f.path, content: f.content, language: f.language })),
        messages: messages.map((m) => ({
          id: m.id,
          role: m.role,
          origin: m.origin,
          content: m.content,
          createdAt: m.createdAt
        }))
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `aig-session-${sessionId}-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      addToast("세션을 export 했습니다.", "success");
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Export 실패", "error");
    }
  }, [sessionId, session, problem, files, messages, addToast]);

  const handleAgentBuild = async () => {
    if (agentBuildLoading) {
      return;
    }

    if (!isBackendSessionId(sessionId)) {
      const nextVersion = agentSnapshotVersion + 1;
      setAgentSnapshotVersion(nextVersion);
      addToast(`Agent Build를 준비했습니다. 스냅샷 v0.${nextVersion}`, "success");
      return;
    }

    setAgentBuildLoading(true);
    try {
      const baseModel = resolveHarnessBaseModel(session?.aiModel);
      const result = await sessionApi.buildHarness(sessionId, baseModel);
      const validErrors = result.validErrors ?? [];
      const errorCount = validErrors.length;
      // compileStatus 가 들어오면 그걸 신뢰. null/undefined 면 errorCount === 0 으로 폴백.
      // (백엔드 snake_case 매핑이 들어오기 전엔 항상 null 이라 errorCount 만 봐야 했음.)
      const buildSucceeded =
        result.compileStatus === "COMPLETED"
          ? true
          : result.compileStatus === "PARTIAL" || result.compileStatus === "FAILED"
            ? false
            : errorCount === 0;

      // 빌드 결과를 store 에 영구적으로 저장 — 빌드 버튼 옆 indicator + valid_errors 드롭다운에서 사용.
      setLastBuildResult({
        compileStatus: result.compileStatus ?? null,
        validErrors,
        builtAt: new Date().toISOString(),
        baseModel
      });

      if (buildSucceeded) {
        setAgentSnapshotVersion((version) => version + 1);
      }

      const partialNote = result.compileStatus === "PARTIAL" ? " (부분 컴파일)" : "";
      // 토스트 메시지 풍부화 — 첫 1개 에러는 path + message 까지 표시해서 어디부터 봐야 할지 즉시 파악.
      const firstErr = validErrors[0];
      const firstErrPreview =
        firstErr && (firstErr.path || firstErr.message)
          ? `\n첫 오류: ${firstErr.path ? `${firstErr.path} · ` : ""}${firstErr.message?.slice(0, 80) ?? ""}`
          : "";
      addToast(
        buildSucceeded
          ? `하네스 빌드 완료 (${baseModel})${partialNote}`
          : `하네스 빌드 실패: 검증 오류 ${errorCount}개${
              result.compileStatus ? ` · ${result.compileStatus}` : ""
            }${firstErrPreview}`,
        buildSucceeded ? "success" : "error"
      );
      await queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
      await queryClient.invalidateQueries({ queryKey: ["agentTraces", sessionId] });
    } catch (error) {
      addToast(error instanceof Error ? error.message : "하네스 빌드에 실패했습니다.", "error");
    } finally {
      setAgentBuildLoading(false);
    }
  };

  // 채팅 답변 markdown 의 코드 블록 — 액션 버튼 (복사 / 새 파일 / 현재 파일 삽입) 붙임.
  // handleCreateFileFromCode: 사용자에게 파일명 prompt → createWorkspaceFile + setActivePath
  const handleCreateFileFromCode = useCallback(
    (code: string, language?: string) => {
      const ext = language === "typescript" ? "ts" : language === "javascript" ? "js" : language ?? "txt";
      const defaultName = `new-file.${ext}`;
      const name = window.prompt("새 파일 경로를 입력하세요 (예: notes/foo.md)", defaultName);
      if (!name?.trim()) return;
      const path = name.trim();
      if (files.some((f) => f.path === path)) {
        addToast(`이미 같은 경로의 파일이 있습니다: ${path}`, "warning");
        return;
      }
      createWorkspaceFile({ path, content: code, language: language ?? "text" }, true);
      addToast(`파일을 만들었습니다: ${path}`, "success");
    },
    [files, createWorkspaceFile, addToast]
  );

  const handleInsertIntoCurrent = useCallback(
    (code: string) => {
      const ed = editorRef.current;
      if (!ed) {
        addToast("열린 에디터가 없습니다.", "warning");
        return;
      }
      const sel = ed.getSelection();
      const op = sel
        ? { range: sel, text: code, forceMoveMarkers: true }
        : { range: { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 }, text: code, forceMoveMarkers: true };
      ed.executeEdits("chat-insert", [op]);
      ed.focus();
      addToast("현재 파일에 삽입했습니다.", "success");
    },
    [addToast]
  );

  // 텍스트에서 file path 패턴을 추출해 클릭 가능 링크로 변환.
  // 매칭 규칙:
  //  · src/.../foo.java, .worktree/foo.java, agent/foo.md, com/aig/.../X.java 등 path-like 토큰
  //  · 확장자 끝나는 케이스만 (false positive 감소)
  // workspace files 에서 매칭되면 클릭 시 setActivePath, 안 매칭되면 평문.
  const fileLookup = useMemo(() => new Set(files.map((f) => f.path)), [files]);
  const linkifyFilePaths = useCallback(
    (text: string): React.ReactNode => {
      // 후보 패턴: 알파벳/숫자/_/-/. 와 / 로 이루어진 토큰, 확장자 (.java/.py/.md/.ts/.tsx/.json/.yml/.yaml/.toml/.gradle/.sql) 로 끝남
      const re = /([\w.\-]+(?:\/[\w.\-]+)+\.(?:java|py|md|ts|tsx|js|jsx|json|yml|yaml|toml|gradle|sql))/g;
      const parts: React.ReactNode[] = [];
      let last = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        const path = m[0];
        const start = m.index;
        if (start > last) parts.push(text.slice(last, start));
        const found =
          fileLookup.has(path)
            ? path
            : fileLookup.has(`agent/${path}`)
              ? `agent/${path}`
              : files.find((f) => f.path.endsWith(path))?.path;
        if (found) {
          parts.push(
            <button
              key={`fp-${start}`}
              type="button"
              className="chat-filepath-link"
              onClick={() => setActivePath(found)}
              title={`파일 열기: ${found}`}
            >
              {path}
            </button>
          );
        } else {
          parts.push(<code key={`fp-${start}`} className="chat-filepath-unknown">{path}</code>);
        }
        last = start + path.length;
      }
      if (last < text.length) parts.push(text.slice(last));
      return parts.length > 0 ? parts : text;
    },
    [files, fileLookup, setActivePath]
  );

  const chatMarkdownComponents = useMemo(
    () => ({
      pre({ children }: { children?: React.ReactNode }) {
        const child = Array.isArray(children) ? children[0] : children;
        if (!child || typeof child !== "object") return <pre>{children}</pre>;
        const element = child as React.ReactElement<{ className?: string; children?: React.ReactNode }>;
        const className = element.props.className ?? "";
        const match = /language-(\w+)/.exec(className);
        const code = String(element.props.children ?? "").replace(/\n$/, "");
        return (
          <ChatCodeBlock
            language={match?.[1]}
            code={code}
            onCreateFile={handleCreateFileFromCode}
            onInsertCurrent={handleInsertIntoCurrent}
          />
        );
      },
      // p / li / strong 등 텍스트 노드 안의 path 패턴을 link 로 변환.
      p({ children }: { children?: React.ReactNode }) {
        return (
          <p>
            {React.Children.map(children, (child) =>
              typeof child === "string" ? linkifyFilePaths(child) : child
            )}
          </p>
        );
      },
      li({ children }: { children?: React.ReactNode }) {
        return (
          <li>
            {React.Children.map(children, (child) =>
              typeof child === "string" ? linkifyFilePaths(child) : child
            )}
          </li>
        );
      }
    }),
    [handleCreateFileFromCode, handleInsertIntoCurrent, linkifyFilePaths]
  );

  const handleSend = async () => {
    if (!chatInput.trim()) {
      return;
    }

    const mode = aiMode === "edit" ? "agent" : "chat";

    // Agent 모드 진입 시 미적용 worktree 파일 알림.
    // AI 서버는 같은 path 를 새로 write 할 때만 이전 worktree row 를 정리 (_delete_previous_worktree_rows).
    // 다른 path 면 기존 worktree 살아남음. 그래도 사용자에게 "검토 대기 중 변경 있음" 을 알려서 묻히지 않도록.
    if (mode === "agent") {
      const pendingWorktree = files.filter((file) => file.path.startsWith(".worktree/"));
      if (pendingWorktree.length > 0) {
        // window.confirm 대신 우리 모달 — UI 일관성 + 스타일 통일.
        setWorktreeConfirm({
          pendingPaths: pendingWorktree.map((f) => f.path),
          onConfirm: () => {
            setWorktreeConfirm(null);
            void doSend();
          }
        });
        return;
      }
    }

    await doSend();
  };

  // 실제 send 로직 — confirm 통과 후 또는 confirm 필요 없을 때 호출.
  const doSend = async () => {
    const question = chatInput.trim();
    if (!question && stagedAttachments.length === 0 && !selectedCode) return;
    const mode = aiMode === "edit" ? "agent" : "chat";

    // 에디터 선택 코드 → 별도 collapsible chip 으로 렌더 (UI), 백엔드 전송 시엔 fenced block 으로 포함 (LLM).
    // 현재 선택된 코드 (자동 첨부) + stagedAttachments (사용자가 "+ 추가" 로 stack 한 것) 합쳐서 보냄.
    const currentSelectionAttachment = selectedCode
      ? {
          path: activeFile?.path ?? "현재 파일",
          code: selectedCode,
          lineRange: selectedRange
            ? `L${selectedRange.startLineNumber}-L${selectedRange.endLineNumber}`
            : undefined
        }
      : undefined;
    // 다중 첨부: stagedAttachments 가 있으면 함께 join, optimistic UI 표시는 첫 번째 chip 만 (간단화).
    // 백엔드로 보내는 backendContent 에는 전부 fenced block 으로 포함되도록 useAiChat 의 첫 attachedCode 외에
    // 나머지를 question 본문 뒤에 직접 append.
    const allAttachments = [
      ...(currentSelectionAttachment ? [currentSelectionAttachment] : []),
      ...stagedAttachments
    ];
    const attachedCode = allAttachments[0];
    // 두 번째 이후 첨부는 user 메시지 본문 안에 직접 fenced block 추가 (useAiChat 의 attachedCode 는 하나만 지원).
    const extraBlocks = allAttachments
      .slice(1)
      .map(
        (a) =>
          `\n\n---\n선택한 코드 (${a.path}${a.lineRange ? ` ${a.lineRange}` : ""}):\n\`\`\`\n${a.code}\n\`\`\``
      )
      .join("");
    clearStagedAttachments();

    setChatInput("");

    try {
      // aiMode "edit" = Agent 패널 (DeepAgent SSE = streamAgentChat),
      // aiMode "chat" = 일반 chat 패널 (streamChat).
      // extraBlocks 는 2번째 이후 첨부를 user 메시지 본문에 직접 append.
      await send(question + extraBlocks, activeFile?.path, chatModel, attachedCode, mode);
      refreshSession();
    } catch (error) {
      addToast(error instanceof Error ? error.message : "AI 요청에 실패했습니다.", "error");
    }
  };

  const renderSectionToggle = (key: ExplorerSectionKey, label: string, meta?: string) => (
    <button type="button" className="section-toggle" onClick={() => toggleExplorerSection(key)}>
      <span className="section-toggle__caret">{explorerSections[key] ? "v" : ">"}</span>
      <span>{label}</span>
      {meta ? <small>{meta}</small> : null}
    </button>
  );

  const toggleFolder = useCallback((folderKey: string) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderKey)) {
        next.delete(folderKey);
      } else {
        next.add(folderKey);
      }
      return next;
    });
  }, []);

  const renderTreeNodes = (nodes: TreeNode[], depth = 0): Array<JSX.Element> =>
    nodes.flatMap((node, index) => {
      const isLast = index === nodes.length - 1;
      const treeGuideLeft = `${6 + depth * 7}px`;
      const treeGuideBottom = isLast ? "50%" : "-4px";

      if (node.kind === "folder") {
        const collapsed = collapsedFolders.has(node.key);
        const folderIcon = getFolderIconSpec(node.name, node.path, !collapsed);
        const folderDisplayName = getFolderDisplayName(node.name, node.path);
        const isCreateTarget = explorerCreateDraft?.parentPath === node.path;
        const isContextTarget = explorerContextMenu?.targetKind === "folder" && explorerContextMenu.targetPath === node.path;
        const isRenameTarget = explorerRenameDraft?.targetKind === "folder" && explorerRenameDraft.targetPath === node.path;
        const isDropTarget = folderDropTargetPath === node.path;
        const isDirtyFolder = collapsed && hasDirtyDescendant(node.path);
        const isWorktreeFolder = node.path === ".worktree";
        return [
          <div key={node.key} className={"tree-branch" + (collapsed ? " tree-branch--closed" : " tree-branch--open")}>
            <button
              type="button"
              className={
                "tree-folder" +
                (collapsed ? " tree-folder--closed" : " tree-folder--open") +
                (isCreateTarget ? " tree-folder--create-target" : "") +
                (isContextTarget ? " tree-folder--context-target" : "") +
                (isDropTarget ? " tree-folder--drop-target" : "")
              }
              aria-expanded={!collapsed}
              style={{
                ["--tree-depth" as string]: depth,
                ["--tree-guide-left" as string]: treeGuideLeft,
                ["--tree-guide-bottom" as string]: treeGuideBottom,
                paddingLeft: `${7 + depth * 7}px`
              }}
              onClick={() => toggleFolder(node.key)}
              onDragOver={(event) => handleExplorerFolderDragOver(event, node.path ?? "")}
              onDrop={(event) => handleExplorerFolderDrop(event, node.path ?? "")}
              onDragLeave={() => setFolderDropTargetPath((current) => (current === node.path ? null : current))}
              onContextMenu={(event) =>
                openExplorerContextMenu(event, {
                  parentPath: node.path,
                  targetPath: node.path,
                  targetKind: "folder"
                })
              }
            >
              <span
                className={"tree-row__twistie codicon " + (collapsed ? "codicon-chevron-right" : "codicon-chevron-down")}
                aria-hidden
              />
              <span
                className={"tree-folder__icon " + folderIcon.iconClass}
                data-folder-kind={folderIcon.kind}
                aria-hidden
              />
              {isRenameTarget ? (
                <input
                  autoFocus
                  className="tree-create-row__input"
                  value={explorerRenameDraft.value}
                  onChange={(event) =>
                    setExplorerRenameDraft((state) => (state ? { ...state, value: event.target.value } : state))
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      commitExplorerRename();
                    }

                    if (event.key === "Escape") {
                      event.preventDefault();
                      cancelExplorerRename();
                    }
                  }}
                  onBlur={cancelExplorerRename}
                  onClick={(event) => event.stopPropagation()}
                />
                ) : (
                  <>
                    <span className={isDirtyFolder ? "tree-row__folder tree-row__folder--dirty" : "tree-row__folder"}>{folderDisplayName}</span>
                    {isDirtyFolder ? <span className="file-row__dot file-row__dot--folder" /> : null}
                    {isWorktreeFolder ? <span className="tree-row__badge">ai</span> : null}
                  </>
                )}
            </button>
            {!collapsed ? (
              <div className="tree-branch__children">
                {explorerCreateDraft?.parentPath === node.path ? (
                  <div
                    className="tree-create-row"
                    style={{ paddingLeft: `${9 + (depth + 1) * 7}px` }}
                  >
                    <span
                      className={
                        explorerCreateDraft.kind === "folder"
                          ? "tree-folder__icon codicon codicon-new-folder"
                          : "file-icon codicon codicon-new-file"
                      }
                      aria-hidden
                    />
                    <input
                      autoFocus
                      className="tree-create-row__input"
                      value={explorerCreateDraft.value}
                      placeholder={explorerCreateDraft.kind === "folder" ? "폴더 이름" : "파일 이름"}
                      onChange={(event) =>
                        setExplorerCreateDraft((state) => (state ? { ...state, value: event.target.value } : state))
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          commitExplorerCreate();
                        }

                        if (event.key === "Escape") {
                          event.preventDefault();
                          cancelExplorerCreate();
                        }
                      }}
                      onBlur={cancelExplorerCreate}
                    />
                  </div>
                ) : null}
                {renderTreeNodes(node.children, depth + 1)}
              </div>
            ) : null}
          </div>
        ];
      }

      const file = node.file;

      if (!file) {
        return [];
      }

      if (file.isVirtual) {
        const isWorktree = file.path.startsWith(".worktree/");
        const isActiveVirtual = isWorktree
          ? activeTabId === createDiffTabId(file.path)
          : activeTabId === file.path;
        const isContextTarget = explorerContextMenu?.targetKind === "file" && explorerContextMenu.targetPath === file.path;
        const fileIcon = getFileIconSpec(file);
        return [
          <button
            key={node.key}
            type="button"
            className={
              isActiveVirtual
                ? "tree-row tree-row--file tree-row--virtual tree-row--active" + (isContextTarget ? " tree-row--context-target" : "")
                : "tree-row tree-row--file tree-row--virtual" + (isContextTarget ? " tree-row--context-target" : "")
            }
            style={{
              ["--tree-depth" as string]: depth,
              ["--tree-guide-left" as string]: treeGuideLeft,
              ["--tree-guide-bottom" as string]: treeGuideBottom,
              paddingLeft: `${9 + depth * 7}px`
            }}
            onClick={() => isWorktree ? openDiffTab(file.path) : focusLine(file.path)}
            onContextMenu={(event) =>
              openExplorerContextMenu(event, {
                parentPath: getFolderPath(file.path) || null,
                targetPath: file.path,
                targetKind: "file"
              })
            }
          >
            <span className="tree-row__main">
              <span
                className={"file-icon " + fileIcon.iconClass}
                data-file-ext={getFileExtension(file)}
                data-file-kind={fileIcon.kind}
                aria-hidden
              />
              <span className="tree-row__label">{node.name}</span>
            </span>
            {file.badge ? <span className="tree-row__badge">{file.badge}</span> : null}
          </button>
        ];
      }

      const fileIcon = getFileIconSpec(file);
      const isContextTarget = explorerContextMenu?.targetKind === "file" && explorerContextMenu.targetPath === file.path;
      const isRenameTarget = explorerRenameDraft?.targetKind === "file" && explorerRenameDraft.targetPath === file.path;
      const isDirtyFile = unsavedPaths.includes(file.path);
      return [
        <button
          key={node.key}
          type="button"
          className={
            file.path === activePath
              ? "tree-row tree-row--file tree-row--active" + (isContextTarget ? " tree-row--context-target" : "")
              : "tree-row tree-row--file" + (isContextTarget ? " tree-row--context-target" : "")
          }
          style={{
            ["--tree-depth" as string]: depth,
            ["--tree-guide-left" as string]: treeGuideLeft,
            ["--tree-guide-bottom" as string]: treeGuideBottom,
            paddingLeft: `${9 + depth * 7}px`
          }}
          draggable
          onDragStart={(event) => handleExplorerFileDragStart(event, file.path)}
          onDragEnd={clearExplorerDragState}
          onClick={() => focusLine(file.path)}
          onContextMenu={(event) =>
            openExplorerContextMenu(event, {
              parentPath: getFolderPath(file.path) || null,
              targetPath: file.path,
              targetKind: "file"
            })
          }
        >
          <span className="tree-row__main">
            <span
              className={"file-icon " + fileIcon.iconClass}
              data-file-ext={getFileExtension(file)}
              data-file-kind={fileIcon.kind}
              aria-hidden
            />
            {isRenameTarget ? (
              <input
                autoFocus
                className="tree-create-row__input"
                value={explorerRenameDraft.value}
                onChange={(event) =>
                  setExplorerRenameDraft((state) => (state ? { ...state, value: event.target.value } : state))
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commitExplorerRename();
                  }

                  if (event.key === "Escape") {
                    event.preventDefault();
                    cancelExplorerRename();
                  }
                }}
                onBlur={cancelExplorerRename}
                onClick={(event) => event.stopPropagation()}
              />
            ) : (
              <span className={isDirtyFile ? "tree-row__label tree-row__label--dirty" : "tree-row__label"}>{node.name}</span>
            )}
          </span>
          {isDirtyFile ? <span className="file-row__dot" /> : null}
        </button>
      ];
    });

  const renderSidebarBody = () => {
    if (sidebarView === "search") {
      return (
        <div className="sidebar-section">
          <div className="sidebar-summary">
            <strong>전역 검색</strong>
            <span>열린 워크스페이스 {files.length}개 파일 기준</span>
          </div>

          <label className="field">
            <span>검색</span>
            <input
              id="ide-search-query"
              name="searchQuery"
              className="input input--compact"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="파일명 또는 코드 검색"
            />
          </label>

          <div className="search-results">
            {searchQuery.trim() ? (
              searchMatches.length ? (
                searchMatches.map((match) => (
                  <button
                    key={match.key}
                    type="button"
                    className="search-result"
                    onClick={() => focusLine(match.path, match.lineNumber)}
                  >
                    <strong>{match.path.split("/").pop()}</strong>
                    <span>{match.path}</span>
                    <small>
                      {match.lineNumber}행 · {match.preview}
                    </small>
                  </button>
                ))
              ) : (
                <div className="empty-inline">검색 결과가 없습니다.</div>
              )
            ) : (
              <div className="empty-inline">검색어를 입력하면 파일과 코드 줄을 함께 찾습니다.</div>
            )}
          </div>
        </div>
      );
    }

    if (sidebarView === "trace") {
      return <TracePanel sessionId={sessionId} />;
    }

    if (sidebarView === "harness") {
      return <HarnessPanel />;
    }

    if (sidebarView === "extensions") {
      return (
        <div className="sidebar-section">
          <div className="sidebar-summary">
            <strong>확장 도구</strong>
            <span>실행 흐름에 필요한 확장을 모아 둔 패널입니다.</span>
          </div>

          <label className="field">
            <span>확장 검색</span>
            <input
              id="ide-extension-query"
              name="extensionQuery"
              className="input input--compact"
              value={extensionQuery}
              onChange={(event) => setExtensionQuery(event.target.value)}
              placeholder="도구 이름 또는 설명 검색"
            />
          </label>

          {extensionMatches.map((item) => (
            <div key={item.name} className="extension-card">
              <div className="extension-card__head">
                <strong>{item.name}</strong>
                <Badge tone={item.state === "추천" ? "amber" : "accent"}>{item.state}</Badge>
              </div>
              <p>{item.summary}</p>
            </div>
          ))}

          {!extensionMatches.length ? <div className="empty-inline">조건에 맞는 확장이 없습니다.</div> : null}
        </div>
      );
    }

    return (
      <div
        className="sidebar-section"
        onContextMenu={(event) =>
          openExplorerContextMenu(event, {
            parentPath: null,
            targetPath: null,
            targetKind: "root"
          })
        }
      >
        <div className="section-block">
          <div className="tree-root tree-root--flat">
            {explorerCreateDraft?.parentPath === null ? (
              <div className="tree-create-row tree-create-row--root" style={{ paddingLeft: "8px" }}>
                <span
                  className={
                    explorerCreateDraft.kind === "folder"
                      ? "tree-folder__icon codicon codicon-new-folder"
                      : "file-icon codicon codicon-new-file"
                  }
                  aria-hidden
                />
                <input
                  autoFocus
                  className="tree-create-row__input"
                  value={explorerCreateDraft.value}
                  placeholder={explorerCreateDraft.kind === "folder" ? "폴더 이름" : "파일 이름"}
                  onChange={(event) =>
                    setExplorerCreateDraft((state) => (state ? { ...state, value: event.target.value } : state))
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      commitExplorerCreate();
                    }

                    if (event.key === "Escape") {
                      event.preventDefault();
                      cancelExplorerCreate();
                    }
                  }}
                  onBlur={cancelExplorerCreate}
                />
              </div>
            ) : null}
            {agentFileTree.length ? (
              <div className="agent-section">
                <button
                  type="button"
                  className="agent-section__header"
                  onClick={() => toggleExplorerSection("agent")}
                >
                  <span>{explorerSections.agent ? "v" : ">"} Agent 설정</span>
                </button>
                {explorerSections.agent ? (
                  <div className="agent-section__subtitle">agent · skills · instruction · harness</div>
                ) : null}
                {explorerSections.agent ? <div className="mt-1">{renderTreeNodes(agentFileTree, 0)}</div> : null}
              </div>
            ) : null}
            {workspaceFileTree.length ? (
              <div>
                <button
                  type="button"
                  className="w-full px-2 pb-1 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400"
                  onClick={() => toggleExplorerSection("project")}
                >
                  {explorerSections.project ? "v" : ">"} Workspace
                </button>
                {explorerSections.project ? renderTreeNodes(workspaceFileTree, 0) : null}
              </div>
            ) : null}
          </div>
        </div>
        {explorerContextMenu ? (
          <div
            className="explorer-context-menu"
            style={{ left: explorerContextMenu.x, top: explorerContextMenu.y }}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="explorer-context-menu__item"
              onClick={() => beginExplorerCreate("file", explorerContextMenu.parentPath)}
            >
              <span className="codicon codicon-new-file" aria-hidden />
              <span>새 파일</span>
            </button>
            <button
              type="button"
              className="explorer-context-menu__item"
              onClick={() => beginExplorerCreate("folder", explorerContextMenu.parentPath)}
            >
              <span className="codicon codicon-new-folder" aria-hidden />
              <span>새 폴더</span>
            </button>
            {explorerContextMenu.targetKind !== "root" ? (
              <button type="button" className="explorer-context-menu__item" onClick={beginExplorerRename}>
                <span className="codicon codicon-edit" aria-hidden />
                <span>이름 바꾸기</span>
              </button>
            ) : null}
            {explorerContextMenu.targetKind !== "root" ? (
              <button type="button" className="explorer-context-menu__item" onClick={handleExplorerDelete}>
                <span className="codicon codicon-trash" aria-hidden />
                <span>삭제</span>
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  };

  const renderBottomPanel = () => {
    if (bottomPanelTab === "submission") {
      return <SubmissionResultPanel result={submissionResult} loading={submissionLoading} />;
    }

    if (bottomPanelTab === "tests") {
      const testElapsedSec = testStartedAtMs
        ? ((solveNow - testStartedAtMs) / 1000).toFixed(1)
        : null;

      return (
        <div className="bottom-panel__body">
          <div className="bottom-summary">
            {testLoading ? (
              <>
                <strong>
                  채점 중 <Badge tone="amber">진행 중</Badge>
                </strong>
                <span>{testElapsedSec ? `${testElapsedSec}초 경과 · ` : ""}도커 러너에서 공개 테스트 케이스를 실행하고 있습니다.</span>
              </>
            ) : testResult ? (
              <>
                <strong>{testResult.passed} / {testResult.total} 통과</strong>
                <span>{testResult.failed}개 실패</span>
              </>
            ) : (
              <>
                <strong>테스트 결과 없음</strong>
                <span>아직 테스트를 실행하지 않았습니다.</span>
              </>
            )}
          </div>

          <div className="stack-12">
            {!testLoading && testResult
              ? testResult.results.map((result) => (
                  <TestResultRow key={result.id} result={result} />
                ))
              : null}
          </div>
        </div>
      );
    }

    if (bottomPanelTab === "trace") {
      return (
        <div className="bottom-panel__body">
          {traces.length ? (
            <div className="trace-list">
              {traces.map((trace: TraceEvent) => (
                <div key={trace.id} className="trace-row">
                  <span className="trace-row__time">{trace.time}</span>
                  <div className="trace-row__body">
                    <strong>{trace.type}</strong>
                    <span>{trace.summary}</span>
                    <small>{trace.detail ?? "상세 정보 없음"}</small>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-inline">아직 기록된 Trace가 없습니다.</div>
          )}
        </div>
      );
    }

    return (
      <div className="bottom-panel__body">
        <div className="output-grid">
          <Card className="mini-panel mini-panel--flat">
            <strong>stdout</strong>
            <pre>{runResult?.stdout ?? "아직 실행한 결과가 없습니다."}</pre>
          </Card>

          <Card className="mini-panel mini-panel--flat">
            <strong>stderr</strong>
            <pre>{runResult?.stderr || "에러 출력 없음"}</pre>
          </Card>
        </div>

        <div className="bottom-summary">
          <strong>{runResult ? `exit code ${runResult.exitCode}` : "실행 대기"}</strong>
          <span>{runResult ? `${runResult.durationMs}ms` : "실행 버튼으로 결과를 확인하세요."}</span>
        </div>
      </div>
    );
  };

  const renderProblemWorkspace = () => {
    if (!problem) {
      return <div className="problem-workspace problem-workspace--empty">문제 정보를 불러오지 못했습니다.</div>;
    }

    return (
      <div className="problem-workspace">
        <aside className="problem-workspace__rail">
          <div className="problem-card problem-card--primary">
            <h2>{problem.title}</h2>
            <p className="muted-copy">{problem.summary}</p>

            <div className="problem-card__pills">
              <span className="problem-pill">Lv.{problem.level}</span>
              <span className="problem-pill">{problem.category}</span>
              <span className="problem-pill">{problem.estimate}</span>
              <span className="problem-pill">{problem.status}</span>
              <span className="problem-pill">{lastSavedLabel}</span>
            </div>

            <div className="problem-card__actions">
              <button
                type="button"
                className="ide-command-button ide-command-button--danger"
                onClick={handleEndSession}
                disabled={endSessionLoading}
                aria-label="종료"
                title="종료"
              >
                <LogOut size={13} strokeWidth={2} />
              </button>
            </div>
          </div>

          <div className="problem-card">
            <strong>문제 체크포인트</strong>
            <ul className="problem-list">
              <li>요구사항 {problemRequirementsCount}개</li>
              <li>공개 테스트 {problemCasesCount}개</li>
              <li>엔드포인트 {problemEndpointCount}개</li>
              <li>AI 사용 무제한</li>
            </ul>
          </div>
        </aside>

        <div className="problem-workspace__main">
          <section className="problem-card problem-card--feature">
            <div className="markdown-block problem-workspace__markdown">
              {parsedProblemBrief.beforeDescription ? (
                <Markdown remarkPlugins={[remarkGfm]} components={problemBriefMarkdownComponents}>{parsedProblemBrief.beforeDescription}</Markdown>
              ) : (
                <p className="muted-copy">문제 설명이 아직 등록되지 않았습니다.</p>
              )}
            </div>
            {resolvedProblemEndpoints.length ? (
              <div className="problem-brief-codeblock problem-brief-codeblock--endpoints">
                <div className="problem-brief-codeblock__body">
                  <div className="problem-brief-codeblock__lines">
                    {resolvedProblemEndpoints.map((_, index) => (
                      <div key={index} className="problem-brief-codeblock__line">
                        {index + 1}
                      </div>
                    ))}
                  </div>
                  <pre className="problem-brief-codeblock__content">
                    {resolvedProblemEndpoints.map((endpoint) => (
                      <div key={endpoint}>{renderHighlightedEndpoint(endpoint)}</div>
                    ))}
                  </pre>
                </div>
              </div>
            ) : (
              <p className="muted-copy">엔드포인트 정보가 아직 등록되지 않았습니다.</p>
            )}
            {parsedProblemBrief.afterDescription ? (
              <div className="markdown-block problem-workspace__markdown">
                <Markdown remarkPlugins={[remarkGfm]} components={problemBriefMarkdownComponents}>{parsedProblemBrief.afterDescription}</Markdown>
              </div>
            ) : null}
          </section>

          {resolvedProblemRequirements.length ? (
            <section className="problem-card problem-card--feature">
              <strong>핵심 요구사항</strong>
              <ul className="problem-list">
                {resolvedProblemRequirements.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <aside className="problem-workspace__aside">
          {resolvedProblemCases.length ? (
            <section className="problem-card">
              <strong>공개 테스트</strong>
              <div className="problem-cases">
                {resolvedProblemCases.map((testCase) => (
                  <div key={testCase.id} className="problem-case">
                    <div className="problem-case__head">
                      <span>{testCase.name}</span>
                      <Badge tone="teal">{testCase.result}</Badge>
                    </div>
                    <small>{testCase.detail}</small>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {resolvedProblemCriteria.length ? (
            <section className="problem-card">
              <strong>평가 기준</strong>
              <ul className="problem-list">
                {resolvedProblemCriteria.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {problem.aiGuide ? (
            <section className="problem-card">
              <strong>AI 활용 팁</strong>
              <p className="muted-copy">{problem.aiGuide}</p>
            </section>
          ) : null}
        </aside>
      </div>
    );
  };

  const renderEditorTopbar = () => (
    <div className="editor-tabbar editor-tabbar--global">
      <div className="editor-tabbar__row editor-tabbar__row--meta">
        <div className="editor-tabbar__context">
          {estimateLimitMs > 0 ? (
            <div className={`solve-timer-bar solve-timer-bar--${timerPhase}`}>
              <div className="solve-timer-bar__track">
                <div
                  className="solve-timer-bar__fill"
                  style={{ width: isOvertime ? "100%" : `${timerProgress * 100}%` }}
                />
              </div>
              <span className="solve-timer-bar__label">
                {isOvertime ? `+${formatSolveElapsed(overtimeMs)}` : solveElapsedLabel}
              </span>
              <span className="solve-timer-bar__limit">{problem?.estimate}</span>
            </div>
          ) : (
            <span className="editor-tabbar__metric editor-tabbar__metric--time">풀이 {solveElapsedLabel}</span>
          )}
          <span className="editor-tabbar__meta">{lastSavedLabel}</span>
        </div>

        <div className="editor-tabbar__actions">
          {session?.aiModel && session.aiModel !== "aig-default" && (
            <span className="ide-model-badge">{session.aiModel}</span>
          )}

          <div className="ide-toolbar">
            <button
              type="button"
              className={autoSaveEnabled ? "ide-toolbar__btn ide-toolbar__btn--active" : "ide-toolbar__btn"}
              onClick={() => setAutoSaveEnabled((state) => !state)}
              aria-pressed={autoSaveEnabled}
              title={autoSaveEnabled ? "자동 저장 끄기" : "자동 저장 켜기"}
            >
              Auto
            </button>
            <button
              type="button"
              className="ide-toolbar__btn"
              onClick={() => void saveAllDirtyFiles()}
              disabled={!dirtyCount || saving}
              aria-label="모두 저장"
              title="모두 저장"
            >
              <Save size={13} strokeWidth={2} />
            </button>

            <span className="ide-toolbar__sep" />

            {/*
              실행 동시성 가드 — 같은 세션에서 테스트와 제출은 docker runner 1번에 한 번만.
              한 쪽이 돌고 있으면 다른 쪽 + 종료 모두 disabled.
              isAnyExecRunning = testLoading | submitLoading | submissionLoading
            */}
            <button
              type="button"
              className="ide-toolbar__btn"
              onClick={() => setConfirmIntent("test")}
              disabled={testLoading || submitLoading || submissionLoading || endSessionLoading}
              title={
                testLoading
                  ? "테스트 채점 중"
                  : submitLoading || submissionLoading
                    ? "제출 채점 중에는 테스트 실행할 수 없습니다"
                    : "공개 테스트 실행"
              }
            >
              {testLoading ? "..." : "테스트"}
            </button>

            <span className="ide-toolbar__sep" />

            <button
              type="button"
              data-tutorial-target="submit"
              className="ide-toolbar__btn ide-toolbar__btn--submit"
              onClick={() => setConfirmIntent("submit")}
              disabled={submitLoading || submissionLoading || testLoading || endSessionLoading}
              title={
                submitLoading || submissionLoading
                  ? "제출 채점 중"
                  : testLoading
                    ? "테스트 실행 중에는 제출할 수 없습니다"
                    : "제출"
              }
            >
              {submitLoading || submissionLoading ? "제출 중..." : "제출"}
            </button>

            <span className="ide-toolbar__sep" />

            <button
              type="button"
              className="ide-toolbar__btn ide-toolbar__btn--exit"
              onClick={() => setConfirmIntent("end-session")}
              disabled={endSessionLoading || testLoading || submitLoading || submissionLoading}
              aria-label="종료"
              title={
                testLoading || submitLoading || submissionLoading
                  ? "실행 / 제출이 끝나야 종료할 수 있습니다"
                  : "종료"
              }
            >
              <LogOut size={13} strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderEditorGroupTabs = (
    group: EditorGroupState,
    groupTabs: WorkspaceTab[],
    groupActiveTab: WorkspaceTab | null,
    groupCanPreviewMarkdown: boolean
  ) => (
    <div className="editor-tabbar editor-tabbar--group">
      <div className="editor-tabbar__row editor-tabbar__row--tabs">
        <div className="editor-tabs" onWheel={handleTabRailWheel}>
          {groupTabs.map((tab) => (
            <div
              key={tab.id}
              className={
                [
                  "editor-tabs__item",
                  activeWorkbenchTab === "code" && group.id === activeEditorGroupId && tab.id === groupActiveTab?.id
                    ? "editor-tabs__item--active"
                    : "",
                  draggedTabId === tab.id ? "editor-tabs__item--dragging" : "",
                  tabDropHint?.targetId === tab.id
                    ? tabDropHint.position === "before"
                      ? "editor-tabs__item--drop-before"
                      : "editor-tabs__item--drop-after"
                    : ""
                ]
                  .filter(Boolean)
                  .join(" ")
              }
              draggable
              onMouseDown={(event) => {
                focusEditorGroup(group.id);

                if (event.button !== 1) {
                  return;
                }

                event.preventDefault();
                event.stopPropagation();
                handleCloseFileTab(tab.id, group.id);
              }}
              onDragStart={(event) => handleTabDragStart(event, tab.id, group.id)}
              onDragOver={(event) => handleTabDragOver(event, tab.id)}
              onDrop={(event) => handleTabDrop(event, tab.id, group.id)}
              onDragEnd={handleTabDragEnd}
            >
              <button
                type="button"
                className="editor-tabs__select"
                onClick={() => {
                  if (tab.kind === "diff") {
                    openDiffTab(tab.targetFile.path, group.id);
                    return;
                  }

                  focusLine(tab.path, undefined, group.id);
                }}
              >
                {tab.kind === "diff" ? (
                  <span className="file-icon file-icon--tab codicon codicon-diff" data-file-kind="git" aria-hidden />
                ) : (
                  <span
                    className={"file-icon file-icon--tab " + getFileIconSpec(tab.file).iconClass}
                    data-file-kind={getFileIconSpec(tab.file).kind}
                    aria-hidden
                  />
                )}
                <span>{tab.title}</span>
                {tab.kind === "file" && unsavedPaths.includes(tab.path) ? <span className="editor-tabs__dot" /> : null}
              </button>
              <button
                type="button"
                className="editor-tabs__close"
                aria-label={`${tab.title} 닫기`}
                onClick={() => handleCloseFileTab(tab.id, group.id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <div className="editor-tabs__tools">
          {groupCanPreviewMarkdown ? (
            <button
              type="button"
              className={markdownPreviewOpen ? "editor-tabs__mode-button editor-tabs__mode-button--active" : "editor-tabs__mode-button"}
              onClick={() => {
                focusEditorGroup(group.id);
                setMarkdownPreviewOpen((state) => !state);
              }}
              aria-pressed={markdownPreviewOpen}
              aria-label={markdownPreviewOpen ? "Markdown 편집" : "Markdown 미리보기"}
              title={markdownPreviewOpen ? "Markdown 편집" : "Markdown 미리보기"}
            >
              {markdownPreviewOpen ? <PencilLine size={14} strokeWidth={2} /> : <Eye size={14} strokeWidth={2} />}
              <span>{markdownPreviewOpen ? "편집" : "미리보기"}</span>
            </button>
          ) : null}

          <button
            type="button"
            className="editor-tabs__mode-button editor-tabs__mode-button--icon"
            onClick={() => {
              focusEditorGroup(group.id);
              splitActiveEditorGroup(group.id, groupActiveTab?.id ?? null);
            }}
            disabled={!groupActiveTab || editorGroups.length >= MAX_EDITOR_GROUPS}
            aria-label="오른쪽으로 분할"
            title="오른쪽으로 분할"
          >
            <span className="codicon codicon-split-horizontal" aria-hidden />
          </button>

          {editorGroups.length > 1 ? (
            <button
              type="button"
              className="editor-tabs__mode-button editor-tabs__mode-button--icon"
              onClick={() => closeEditorGroup(group.id)}
              aria-label="에디터 그룹 닫기"
              title="에디터 그룹 닫기"
            >
              <span className="codicon codicon-close" aria-hidden />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );

  const renderEditorGroup = (group: EditorGroupState) => {
    const groupTabs = getGroupTabs(group);
    const groupActiveTab = groupTabs.find((tab) => tab.id === group.activeTabId) ?? groupTabs[0] ?? null;
    const groupActiveFile =
      groupActiveTab?.kind === "diff"
        ? groupActiveTab.sourceFile
        : groupActiveTab?.kind === "file"
          ? groupActiveTab.file
          : null;
    const groupCanPreviewMarkdown =
      group.id === activeEditorGroupId && groupActiveTab?.kind === "file" && isMarkdownWorkspaceFile(groupActiveFile);
    const groupPreviewOpen = groupCanPreviewMarkdown && markdownPreviewOpen;
    const groupIsActive = group.id === activeEditorGroupId;

    return (
      <section
        key={group.id}
        className={groupIsActive ? "editor-group editor-group--active" : "editor-group"}
        ref={(node) => {
          if (node) {
            editorGroupRefsRef.current.set(group.id, node);
          } else {
            editorGroupRefsRef.current.delete(group.id);
          }
        }}
        style={
          editorGroupSizes[group.id]
            ? { flex: `0 0 ${editorGroupSizes[group.id]}px` }
            : undefined
        }
        onMouseDown={() => focusEditorGroup(group.id)}
        onDragOver={handleTabDragOverGroup}
        onDrop={(event) => handleTabDropToGroup(event, group.id)}
      >
        {renderEditorGroupTabs(group, groupTabs, groupActiveTab, groupCanPreviewMarkdown)}

        {!groupActiveFile || !groupActiveTab ? (
          <div className="editor-empty-state">
            <strong>열린 탭이 없습니다.</strong>
            <span>탐색기에서 파일을 열거나 다른 그룹의 탭을 분할하세요.</span>
          </div>
        ) : (
          <div
            ref={(node) => {
              if (node) {
                editorHostRefsRef.current.set(group.id, node);
                if (groupIsActive) {
                  editorHostRef.current = node;
                }
              } else {
                editorHostRefsRef.current.delete(group.id);
              }
            }}
            className={groupPreviewOpen ? "editor-host editor-host--preview" : "editor-host"}
            onMouseDown={() => focusEditorGroup(group.id)}
          >
            {groupPreviewOpen ? (
              <div className="markdown-preview">
                <Markdown remarkPlugins={[remarkGfm]} components={problemBriefMarkdownComponents}>
                  {groupActiveFile.content || "_미리볼 Markdown 내용이 없습니다._"}
                </Markdown>
              </div>
            ) : groupActiveTab.kind === "diff" ? (
              <div className="diff-pane">
                <div className="diff-pane__actions">
                  <div className="diff-pane__label">
                    <span className="codicon codicon-diff" aria-hidden />
                    <span>AI 워크트리 수정 제안 — 적용 시 원본 파일이 덮어써집니다</span>
                  </div>
                  <div className="diff-pane__buttons">
                    {/* worktree 파일이 2개 이상일 때만 일괄 처리 노출 — 한 개면 단일 [적용]/[거절] 만으로 충분 */}
                    {files.filter((file) => file.path.startsWith(".worktree/")).length >= 2 ? (
                      <>
                        <button
                          type="button"
                          className="button button--ghost"
                          onClick={() => void handleAllEdit(false)}
                          title="이 세션의 모든 AI 수정 제안 거절"
                        >
                          모두 거절
                        </button>
                        <button
                          type="button"
                          className="button button--ghost"
                          onClick={() => void handleAllEdit(true)}
                          title="이 세션의 모든 AI 수정 제안 일괄 적용"
                        >
                          모두 적용
                        </button>
                        <span className="diff-pane__divider" aria-hidden>|</span>
                      </>
                    ) : null}
                    <button
                      type="button"
                      className="button button--ghost"
                      onClick={() => void handlePartialEdit(groupActiveTab.targetFile.path, false)}
                    >
                      거절
                    </button>
                    <button
                      type="button"
                      className="button button--primary"
                      onClick={() => void handlePartialEdit(groupActiveTab.targetFile.path, true)}
                    >
                      적용
                    </button>
                  </div>
                </div>
                <SafeDiffEditor
                  key={`${group.id}:${groupActiveTab.id}`}
                  theme={theme === "dark" ? "vs-dark" : "vs"}
                  height="100%"
                  original={groupActiveTab.sourceFile.content}
                  modified={groupActiveTab.targetFile.content}
                  language={groupActiveTab.sourceFile.language}
                  onMount={handleDiffMount(group.id)}
                  options={{
                    readOnly: true,
                    renderSideBySide: viewportSize.width > 1480,
                    originalEditable: false,
                    fontSize: 13,
                    scrollBeyondLastLine: false,
                    fontFamily: "var(--font-mono)",
                    lineHeight: 22,
                    automaticLayout: true,
                    smoothScrolling: true,
                    stickyScroll: { enabled: false },
                    overviewRulerBorder: false,
                    minimap: { enabled: false }
                  }}
                />
              </div>
            ) : (
              <MonacoEditor
                key={`${group.id}:${groupActiveFile.path}`}
                path={`${group.id}:${groupActiveFile.path}`}
                theme={theme === "dark" ? "vs-dark" : "vs"}
                height="100%"
                language={groupActiveFile.language}
                value={groupActiveFile.content}
                onMount={handleMount(group.id)}
                onChange={(value) => {
                  const nextContent = value ?? "";
                  if (nextContent !== groupActiveFile.content) {
                    updateFileContent(groupActiveFile.path, nextContent);
                  }
                }}
                options={{
                  minimap: { enabled: true, scale: 0.9, showSlider: "mouseover" },
                  fontSize: 13,
                  scrollBeyondLastLine: false,
                  fontFamily: "var(--font-mono)",
                  lineHeight: 22,
                  automaticLayout: true,
                  smoothScrolling: true,
                  padding: { top: 14 },
                  stickyScroll: { enabled: false },
                  overviewRulerBorder: false
                }}
              />
            )}
          </div>
        )}
      </section>
    );
  };

  if (isLoading || !session || !activeFile) {
    return (
      <div className="center-shell">
        <div className="loader-card">
          <span className="eyebrow">워크스페이스</span>
          <strong>IDE를 준비하고 있습니다.</strong>
        </div>
      </div>
    );
  }

  return (
    <div
      className="ide-route ide-route--workspace"
      onContextMenu={handleIdeContextMenu}
    >
      <section className="ide-shell ide-shell--workbench">
        <aside className="activity-bar">
          <div className="activity-bar__group">
            <button
              type="button"
              data-tutorial-target="problem"
              className={activeWorkbenchTab === "problem" ? "activity-bar__item activity-bar__item--active" : "activity-bar__item"}
              title="문제"
              onClick={handleOpenProblemTab}
            >
              <span className="activity-bar__label activity-bar__icon-wrap">
                <span className="codicon codicon-book activity-bar__icon" aria-hidden="true" />
              </span>
            </button>

            {activityItems.filter((item) => item.id !== "extensions").map((item) =>
              item.id === "trace" ? (
                <button
                  key={item.id}
                  type="button"
                  data-tutorial-target={item.id}
                  className={
                    activeWorkbenchTab === "trace"
                      ? "activity-bar__item activity-bar__item--active"
                      : "activity-bar__item"
                  }
                  title={item.label}
                  onClick={() => setActiveWorkbenchTab("trace")}
                >
                  <span className="activity-bar__label activity-bar__icon-wrap">
                    <span className={`codicon ${item.icon} activity-bar__icon`} aria-hidden="true" />
                  </span>
                  {activityMeta[item.id] ? <span className="activity-bar__badge">{activityMeta[item.id]}</span> : null}
                </button>
              ) : (
                <button
                  key={item.id}
                  type="button"
                  data-tutorial-target={item.id}
                  className={
                    activeWorkbenchTab === "code" && sidebarOpen && sidebarView === item.id
                      ? "activity-bar__item activity-bar__item--active"
                      : "activity-bar__item"
                  }
                  title={item.label}
                  onClick={() => handleActivityClick(item.id)}
                >
                  <span className="activity-bar__label activity-bar__icon-wrap">
                    <span className={`codicon ${item.icon} activity-bar__icon`} aria-hidden="true" />
                  </span>
                  {activityMeta[item.id] ? <span className="activity-bar__badge">{activityMeta[item.id]}</span> : null}
                </button>
              )
            )}

            <button
              type="button"
              data-tutorial-target="console"
              className={activeWorkbenchTab === "code" && showBottomPanel ? "activity-bar__item activity-bar__item--active" : "activity-bar__item"}
              title="콘솔"
              onClick={handleToggleBottomPanel}
            >
              <span className="activity-bar__label activity-bar__icon-wrap">
                <span className="codicon codicon-terminal activity-bar__icon" aria-hidden="true" />
              </span>
              {activityMeta.output ? <span className="activity-bar__badge">{activityMeta.output}</span> : null}
            </button>

            <button
              type="button"
              data-tutorial-target="ai"
              className={activeWorkbenchTab === "code" && aiOpen ? "activity-bar__item activity-bar__item--active" : "activity-bar__item"}
              title="AI 보조 패널"
              onClick={handleToggleAiPanel}
            >
              <span className="activity-bar__label activity-bar__icon-wrap">
                <span className="codicon codicon-hubot activity-bar__icon" aria-hidden="true" />
              </span>
              {activityMeta.ai ? <span className="activity-bar__badge">{activityMeta.ai}</span> : null}
            </button>
          </div>
          <div className="activity-bar__group" style={{ marginTop: "auto" }}>
            <button
              type="button"
              className={tourActive ? "activity-bar__item activity-bar__item--active" : "activity-bar__item"}
              title="튜토리얼 투어"
              onClick={() => {
                setTourStepIndex(0);
                setTourActive(true);
              }}
            >
              <span className="activity-bar__label activity-bar__icon-wrap">
                <span className="codicon codicon-question activity-bar__icon" aria-hidden="true" />
              </span>
              {completedTutorialSteps.size > 0 && completedTutorialSteps.size < tutorialSteps.length ? (
                <span className="activity-bar__badge">
                  {completedTutorialSteps.size}/{tutorialSteps.length}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              className="activity-bar__item"
              title={theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"}
              onClick={toggleTheme}
            >
              {theme === "dark" ? <Sun size={14} strokeWidth={1.8} /> : <Moon size={14} strokeWidth={1.8} />}
              <span className="sr-only">{theme === "dark" ? "라이트 모드" : "다크 모드"}</span>
            </button>
          </div>
        </aside>

        {activeWorkbenchTab === "trace" ? (
          <div className="ide-shell__trace-wb">
            <TraceWorkbench sessionId={sessionId} onClose={() => setActiveWorkbenchTab("code")} />
          </div>
        ) : activeWorkbenchTab === "problem" ? (
          <div className="ide-shell__problem">
            <div className="problem-stage">{renderProblemWorkspace()}</div>
            <div className="status-bar">
              <div className="status-bar__group">
                <span>problem</span>
                <span>Lv.{problem?.level ?? 1}</span>
                <span>{problem?.category ?? "문제"}</span>
                <span>공개케이스 {problemCasesCount}개</span>
              </div>
              <div className="status-bar__group">
                <span>{problem?.estimate ?? "예상 시간 없음"}</span>
                <span>AI 무제한</span>
                <span className={`save-indicator ${saving ? "save-indicator--saving" : dirtyCount ? "save-indicator--dirty" : "save-indicator--saved"}`}>
                  {(() => {
                    if (saving) return "● 저장 중...";
                    if (dirtyCount) return `● 미저장 ${dirtyCount}개`;
                    if (!lastSavedDate) return "✓ 저장됨";
                    const diff = Date.now() - lastSavedDate.getTime();
                    if (diff < 5_000) return "✓ 방금 저장됨";
                    if (diff < 60_000) return `✓ ${Math.floor(diff / 1000)}초 전 저장`;
                    if (diff < 3_600_000) return `✓ ${Math.floor(diff / 60_000)}분 전 저장`;
                    return "✓ 저장됨";
                  })()}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <>
            {sidebarOpen ? (
              <>
                <aside className="ide-shell__sidebar" style={{ width: effectiveSidebarWidth }}>
                  <div className="sidebar-header">
                    <div>
                      <span className="panel-title panel-title--compact">{sidebarView}</span>
                      <strong>{activityItems.find((item) => item.id === sidebarView)?.label ?? "탐색기"}</strong>
                    </div>
                  </div>

                  {renderSidebarBody()}
                </aside>

                <div
                  className="pane-resizer pane-resizer--vertical"
                  onMouseDown={beginResize("sidebar")}
                  aria-hidden="true"
                />
              </>
            ) : (
              <div
                className="pane-resizer pane-resizer--vertical pane-resizer--collapsed pane-resizer--sidebar-collapsed"
                onMouseDown={beginResize("sidebar")}
                aria-hidden="true"
              />
            )}

            <div className="ide-shell__main">
              {renderEditorTopbar()}

              <div className="editor-stage">
                <div className="editor-groups">
                  {showEmptyEditor ? (
                    <div className="editor-empty-state">
                      <strong>열린 탭이 없습니다.</strong>
                      <span>왼쪽 탐색기에서 파일을 열거나, 문제 아이콘으로 문제 화면을 확인하세요.</span>
                    </div>
                  ) : (
                    <>
                      {editorGroups.map((group, index) => (
                        <Fragment key={group.id}>
                          {renderEditorGroup(group)}
                          {index < editorGroups.length - 1 ? (
                            <div
                              className="editor-group-resizer"
                              onMouseDown={beginEditorGroupResize(group.id, editorGroups[index + 1].id)}
                              aria-hidden="true"
                            />
                          ) : null}
                        </Fragment>
                      ))}
                      {draggedTabId && editorGroups.length < MAX_EDITOR_GROUPS ? (
                        <div
                          className="editor-split-drop-zone"
                          onDragOver={handleTabSplitDragOver}
                          onDrop={handleTabSplitDrop}
                        >
                          <span className="codicon codicon-split-horizontal" aria-hidden />
                          <strong>오른쪽에 분할</strong>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>

                {showBottomPanel ? (
                  <>
                    <div
                      className="pane-resizer pane-resizer--horizontal"
                      onMouseDown={beginResize("bottom")}
                      aria-hidden="true"
                    />
                    <section className="bottom-panel" style={{ height: effectiveBottomPanelHeight }}>
                      <div className="bottom-panel__tabs">
                        <div className="bottom-panel__tab-list">
                          {bottomTabs.map((tab) => (
                            <button
                              key={tab.id}
                              type="button"
                              className={
                                bottomPanelTab === tab.id
                                  ? "bottom-panel__tab bottom-panel__tab--active"
                                  : "bottom-panel__tab"
                              }
                              onClick={() => setBottomPanelTab(tab.id)}
                            >
                              {tab.label}
                              <small>{bottomTabMeta[tab.id]}</small>
                            </button>
                          ))}
                        </div>
                      </div>

                      {renderBottomPanel()}
                    </section>
                  </>
                ) : (
                  <div
                    className="pane-resizer pane-resizer--horizontal pane-resizer--collapsed pane-resizer--bottom-collapsed"
                    onMouseDown={beginResize("bottom")}
                    aria-hidden="true"
                  />
                )}
              </div>

              <div className="status-bar">
                <div className="status-bar__group">
                  <span>main</span>
                  <span>{activeFile.language.toUpperCase()}</span>
                  <span>UTF-8</span>
                  <span>LF</span>
                  <span>{lineCount} lines</span>
                </div>

                <div className="status-bar__group">
                  <span className={`save-indicator ${saving ? "save-indicator--saving" : dirtyCount ? "save-indicator--dirty" : "save-indicator--saved"}`}>
                  {(() => {
                    if (saving) return "● 저장 중...";
                    if (dirtyCount) return `● 미저장 ${dirtyCount}개`;
                    if (!lastSavedDate) return "✓ 저장됨";
                    const diff = Date.now() - lastSavedDate.getTime();
                    if (diff < 5_000) return "✓ 방금 저장됨";
                    if (diff < 60_000) return `✓ ${Math.floor(diff / 1000)}초 전 저장`;
                    if (diff < 3_600_000) return `✓ ${Math.floor(diff / 60_000)}분 전 저장`;
                    return "✓ 저장됨";
                  })()}
                </span>
                  <span>{selectionLabel}</span>
                  <span>{aiMode === "chat" ? "AIG Chat" : "AIG Edit"}</span>
                  <span>{activeTab?.kind === "diff" ? "DIFF" : bottomPanelTab.toUpperCase()}</span>
                </div>
              </div>
            </div>

            {aiOpen ? (
              <>
                <div
                  className="pane-resizer pane-resizer--vertical"
                  onMouseDown={beginResize("ai")}
                  aria-hidden="true"
                />

                <aside className="ide-shell__ai" style={{ width: effectiveAiPanelWidth }}>
                  <div className="sidebar-header">
                    <div>
                      <span className="panel-title panel-title--compact">aig assistant</span>
                      <div className="assistant-header__title">
                        <strong>AI 보조 패널</strong>
                        <span className="ai-context-chip assistant-version-chip">{agentSnapshotLabel}</span>
                      </div>
                    </div>

                    <div className="assistant-build-wrap">
                      <button
                        type="button"
                        className="button button--primary button--tiny assistant-build-button"
                        onClick={() => void handleAgentBuild()}
                        disabled={agentBuildLoading}
                        title="하네스(AGENTS.md · prompts · skills · sub_agent) 를 다시 컴파일해서 에이전트를 새로 부팅합니다. 세션 시작 시 기본 하네스로 자동 빌드돼 있어 누르지 않아도 작동하지만, 하네스 파일을 수정한 뒤엔 한 번 눌러 반영해야 합니다."
                      >
                        {agentBuildLoading ? "하네스 빌드 중..." : "하네스 빌드"}
                      </button>
                      {lastBuildResult ? (
                        <BuildStatusIndicator
                          result={lastBuildResult}
                          onErrorClick={(err) => {
                            const path = err.path;
                            if (!path) return;
                            // 하네스 파일이면 agent/ prefix, 워크트리/소스면 그대로 시도. files 에 있으면 setActivePath.
                            const candidates = [
                              path,
                              path.startsWith("agent/") ? path : `agent/${path}`,
                              path.replace(/^agent\//, "")
                            ];
                            const found = candidates.find((p) => files.some((f) => f.path === p));
                            if (found) setActivePath(found);
                            else addToast(`파일을 찾을 수 없습니다: ${path}`, "warning");
                          }}
                        />
                      ) : null}
                    </div>
                  </div>

                  <div className="ai-panel ai-panel--chat">
                    <div className="ai-panel__head">
                      <div className="ai-tabs ai-tabs--segmented">
                        <button
                          type="button"
                          className={aiMode === "chat" ? "chip chip--active" : "chip"}
                          onClick={() => {
                            setAiMode("chat");
                            setSuggestion(null);
                          }}
                        >
                          Chat
                        </button>
                        <button
                          type="button"
                          className={aiMode === "edit" ? "chip chip--active" : "chip"}
                          onClick={() => setAiMode("edit")}
                        >
                          Agent
                        </button>
                      </div>

                      <div className="ai-context-strip">
                        <span className="ai-context-chip" title={activeFile.path}>
                          {getFileName(activeFile.path)}
                        </span>
                        <span className="ai-context-chip">
                          {selectedRange ? selectionSummary : "선택 없음"}
                        </span>
                        {selectedCode ? (
                          <button
                            type="button"
                            className="ai-context-chip ai-context-chip--add"
                            onClick={() => {
                              addStagedAttachment({
                                path: activeFile?.path ?? "현재 파일",
                                code: selectedCode,
                                lineRange: selectedRange
                                  ? `L${selectedRange.startLineNumber}-L${selectedRange.endLineNumber}`
                                  : undefined
                              });
                              addToast("코드 첨부에 추가했습니다.", "success");
                            }}
                            title="현재 선택한 코드를 첨부 스택에 추가"
                          >
                            + 첨부 추가
                          </button>
                        ) : null}
                      </div>
                      {stagedAttachments.length > 0 ? (
                        <div className="staged-attach-strip">
                          {stagedAttachments.map((att, idx) => (
                            <span key={`${att.path}-${idx}`} className="staged-attach-chip" title={`${att.path}${att.lineRange ? ` ${att.lineRange}` : ""}`}>
                              <span className="staged-attach-chip__name">
                                {att.path.split(/[\\/]/).pop()}
                                {att.lineRange ? ` ${att.lineRange}` : ""}
                              </span>
                              <button
                                type="button"
                                className="staged-attach-chip__remove"
                                onClick={() => removeStagedAttachment(idx)}
                                aria-label="첨부 제거"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>

                      {aiMode === "edit" && agentPatchPreviews.length ? (
                        <Card className="mini-panel mini-panel--flat assistant-changes-card">
                          <div className="assistant-changes__head">
                            <div>
                              <strong>Agent worktree 변경</strong>
                              <p className="muted-copy">
                                {agentPatchPreviews.length}개 파일에 수정 제안이 준비되었습니다. 클릭하면 diff 탭에서 적용/거절할 수 있어요.
                              </p>
                            </div>
                            <span className="ai-context-chip">{agentPatchPreviews.length} files</span>
                          </div>
                          {latestAgentPatchSummary ? (
                            <p className="muted-copy assistant-changes__summary">{latestAgentPatchSummary}</p>
                          ) : null}
                          <div className="assistant-changes__list">
                            {agentPatchPreviews.map((preview) => (
                              <button
                                key={preview.patchId}
                                type="button"
                                className="assistant-change-row"
                                onClick={() => openDiffTab(preview.worktreePath)}
                              >
                                <span className="assistant-change-row__main">
                                  <strong>{getFileName(preview.filePath)}</strong>
                                  <small>{preview.filePath}</small>
                                </span>
                                <span className="assistant-change-row__stats">
                                  <span className="assistant-change-row__add">+{preview.additions}</span>
                                  <span className="assistant-change-row__del">-{preview.deletions}</span>
                                </span>
                              </button>
                            ))}
                          </div>
                        </Card>
                      ) : null}

                      <div ref={chatScrollRef} className="chat-stack chat-stack--panel">
                        {(() => {
                          // Chat/Agent 토글에 맞춰 origin 으로 필터링. origin 이 비어있는 옛 메시지는
                          // 양쪽 모두에 표시 (백엔드 union 이전에 저장된 케이스 안전망).
                          const wantOrigin = aiMode === "edit" ? "AGENT" : "CHAT";
                          const visibleMessages = messages.filter(
                            (m) => !m.origin || m.origin === wantOrigin
                          );
                          return (
                            <>
                              {visibleMessages.length === 0 && !streaming ? (
                                <div className="chat-empty">
                                  <strong>
                                    {aiMode === "edit"
                                      ? "에이전트에게 작업을 위임해 보세요"
                                      : "AI와 대화를 시작해 보세요"}
                                  </strong>
                                  <p className="muted-copy">
                                    {aiMode === "edit"
                                      ? "에이전트가 .worktree/ 에 수정안을 만들면 diff 탭에서 적용/거절할 수 있어요."
                                      : "현재 열린 파일과 선택한 코드를 컨텍스트로 질문할 수 있어요."}
                                  </p>
                                </div>
                              ) : null}
                              {visibleMessages.map((message) => {
                          const hasAgentEvents = (message.agentEvents?.length ?? 0) > 0;
                          const isEmptyAssistant = message.role === "assistant" && !message.content && !hasAgentEvents;
                          return (
                            <div
                              key={message.id}
                              className={message.role === "user" ? "chat-bubble chat-bubble--user" : "chat-bubble"}
                            >
                              {message.role === "user" && !streaming ? (
                                <button
                                  type="button"
                                  className="chat-bubble__resend"
                                  onClick={() => {
                                    setChatInput(message.content);
                                    window.requestAnimationFrame(() => {
                                      document.getElementById("ide-chat-input")?.focus();
                                    });
                                  }}
                                  title="이 메시지를 입력창에 다시 채우기"
                                  aria-label="재전송"
                                >
                                  ↻
                                </button>
                              ) : null}
                              {hasAgentEvents ? (
                                /* Agent 진행 로그를 fold 가능한 카드로 — 스트리밍 중엔 펼친 상태,
                                   백엔드 hydrate 로 content 가 들어오면 자동으로 카드는 사라지고 변경 요약만 남는다. */
                                <details className="agent-progress-card" open={!message.content}>
                                  <summary className="agent-progress-card__summary">
                                    <span>🛠️ 에이전트 진행 ({message.agentEvents!.length}단계)</span>
                                    {streaming && message.role === "assistant" && !message.content ? (
                                      <span className="chat-typing chat-typing--inline" aria-label="진행 중">
                                        <span className="chat-typing__dot" />
                                        <span className="chat-typing__dot" />
                                        <span className="chat-typing__dot" />
                                      </span>
                                    ) : null}
                                    {message.traceId ? (
                                      <button
                                        type="button"
                                        className="agent-progress-card__trace-link"
                                        onClick={(event) => {
                                          // <summary> 위에 있어서 클릭이 fold 토글로 가지 않도록 막음.
                                          event.preventDefault();
                                          event.stopPropagation();
                                          setTraceJumpToId(message.traceId!);
                                          setActiveWorkbenchTab("trace");
                                        }}
                                        title="이 agent run 의 Trace 상세로 이동"
                                      >
                                        Trace 보기 →
                                      </button>
                                    ) : null}
                                  </summary>
                                  <ol className="agent-progress-card__list">
                                    {message.agentEvents!.map((event, idx) => (
                                      <li key={`${event.type}-${idx}`} className="agent-progress-card__item">
                                        <span className="agent-progress-card__prefix">{event.prefix}</span>
                                        <span className="agent-progress-card__message">{event.message}</span>
                                        {event.detail ? (
                                          <code className="agent-progress-card__detail">{event.detail}</code>
                                        ) : null}
                                      </li>
                                    ))}
                                  </ol>
                                </details>
                              ) : null}
                              {isEmptyAssistant ? (
                                <span className="chat-typing" aria-label="AI 응답 생성 중">
                                  <span className="chat-typing__dot" />
                                  <span className="chat-typing__dot" />
                                  <span className="chat-typing__dot" />
                                </span>
                              ) : message.content ? (
                                <div className="chat-bubble__markdown">
                                  <Markdown remarkPlugins={[remarkGfm]} components={chatMarkdownComponents}>{message.content}</Markdown>
                                </div>
                              ) : null}
                              {message.attachedCode ? <AttachedCodeChip data={message.attachedCode} /> : null}
                            </div>
                          );
                              })}
                            </>
                          );
                        })()}
                      </div>

                      <div className="chat-input-row">
                        <textarea
                          id="ide-chat-input"
                          name="chatPrompt"
                          className="input input--textarea"
                          value={chatInput}
                          onChange={(event) => setChatInput(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                              event.preventDefault();
                              void handleSend();
                            }
                          }}
                          placeholder="현재 문제나 코드에 대해 질문하세요  (Ctrl+Enter 전송)"
                        />
                        <div className="chat-composer-actions">
                          <div className="model-dropdown" ref={modelDropdownRef}>
                            <button
                              type="button"
                              className="model-dropdown__trigger"
                              onClick={() => setModelDropdownOpen((v) => !v)}
                              aria-haspopup="listbox"
                              aria-expanded={modelDropdownOpen}
                            >
                              <span className="model-dropdown__label">
                                {CHAT_MODEL_OPTIONS.find((o) => o.id === chatModel)?.label ?? chatModel}
                              </span>
                              <span className="model-dropdown__caret" aria-hidden>▾</span>
                            </button>
                            {modelDropdownOpen ? (
                              <ul className="model-dropdown__menu" role="listbox">
                                {CHAT_MODEL_OPTIONS.map((option) => {
                                  const active = option.id === chatModel;
                                  return (
                                    <li key={option.id}>
                                      <button
                                        type="button"
                                        role="option"
                                        aria-selected={active}
                                        className={active ? "model-dropdown__option model-dropdown__option--active" : "model-dropdown__option"}
                                        onClick={() => {
                                          setChatModel(option.id);
                                          setModelDropdownOpen(false);
                                        }}
                                      >
                                        <span className={`model-dropdown__badge model-dropdown__badge--${option.provider}`}>
                                          {option.provider === "anthropic" ? "C" : "G"}
                                        </span>
                                        <span className="model-dropdown__option-label">{option.label}</span>
                                        {active ? <span className="model-dropdown__check" aria-hidden>✓</span> : null}
                                      </button>
                                    </li>
                                  );
                                })}
                              </ul>
                            ) : null}
                          </div>
                          {streaming ? (
                            <button
                              className="button button--ghost chat-composer-actions__send"
                              onClick={abort}
                              type="button"
                              title="진행 중인 요청 중지"
                            >
                              ⏹ 중지
                            </button>
                          ) : (
                            <button
                              className="button button--primary chat-composer-actions__send"
                              onClick={handleSend}
                              disabled={!chatInput.trim()}
                            >
                              전송 →
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                </aside>
              </>
            ) : (
              <div
                className="pane-resizer pane-resizer--vertical pane-resizer--collapsed pane-resizer--ai-collapsed"
                onMouseDown={beginResize("ai")}
                aria-hidden="true"
              />
            )}
          </>
        )}
      </section>
      {savePromptOpen && savePromptAction ? (
        <div className="ide-save-modal-backdrop" role="presentation" onClick={handleSavePromptCancel}>
          <div
            className="ide-save-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ide-save-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="ide-save-modal__head">
              <strong id="ide-save-modal-title">{savePromptTitle}</strong>
              <span>{savePromptDescription}</span>
            </div>
            <div className="ide-save-modal__actions">
              <button type="button" className="button" onClick={handleSavePromptCancel} disabled={saving}>
                취소
              </button>
              <button type="button" className="button" onClick={() => void handleSavePromptDiscard()} disabled={saving}>
                저장 안 함
              </button>
              <button
                type="button"
                className="button button--primary"
                onClick={() => void handleSavePromptSave()}
                disabled={saving}
              >
                {saving
                  ? "저장 중..."
                  : savePromptAction.type === "navigate"
                    ? "저장 후 이동"
                    : savePromptAction.type === "end-session"
                      ? "저장 후 종료"
                      : "저장"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* 테스트 / 제출 / 종료 실수 방지 확인 모달 */}
      {confirmIntent ? (
        <div
          className="ide-save-modal-backdrop"
          role="presentation"
          onClick={() => setConfirmIntent(null)}
        >
          <div
            className="ide-save-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ide-save-modal__head">
              <strong>
                {confirmIntent === "test"
                  ? "테스트를 실행할까요?"
                  : confirmIntent === "submit"
                    ? "제출하시겠습니까?"
                    : "세션을 종료할까요?"}
              </strong>
              <span>
                {confirmIntent === "test"
                  ? "공개 테스트 케이스를 도커 러너에서 실행합니다. 평균 30초~2분 정도 걸립니다."
                  : confirmIntent === "submit"
                    ? "현재 코드 스냅샷으로 공개·비공개 테스트를 함께 채점합니다. 한 세션에서 여러 번 제출할 수 있습니다."
                    : "세션을 종료하면 같은 풀이로 돌아올 수 없습니다. 진행 중인 작업이 있다면 먼저 저장하세요."}
              </span>
            </div>
            <div className="ide-save-modal__actions">
              <button
                type="button"
                className="button"
                onClick={() => setConfirmIntent(null)}
              >
                취소
              </button>
              <button
                type="button"
                className="button button--primary"
                onClick={() => {
                  const intent = confirmIntent;
                  setConfirmIntent(null);
                  if (intent === "test") void handleTest();
                  else if (intent === "submit") void handleSubmit();
                  else if (intent === "end-session") handleEndSession();
                }}
              >
                {confirmIntent === "test"
                  ? "테스트 실행"
                  : confirmIntent === "submit"
                    ? "제출"
                    : "종료"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {tourActive && currentTourStep ? (() => {
        const groups = groupAdjacentTourRects(tourTargetRects);
        const groupPaths = groups.map((g) => pathForGroup(g));
        return (
        <div className="tour-overlay" role="dialog" aria-modal="true" aria-label="IDE 튜토리얼 투어">
          {tourTargetRects.length > 0 ? (
            <svg className="tour-overlay__mask" width="100%" height="100%">
              <defs>
                <mask id="tour-mask">
                  <rect fill="white" x="0" y="0" width="100%" height="100%" />
                  {groupPaths.map((d, idx) => (
                    <path key={`mask-${idx}`} fill="black" d={d} />
                  ))}
                </mask>
              </defs>
              <rect
                fill="rgba(15, 18, 32, 0.6)"
                x="0"
                y="0"
                width="100%"
                height="100%"
                mask="url(#tour-mask)"
              />
              {groupPaths.map((d, idx) => (
                <path
                  key={`ring-${idx}`}
                  className="tour-spotlight-ring-path"
                  d={d}
                  fill="none"
                  stroke="#8b8cff"
                  strokeWidth={2}
                />
              ))}
            </svg>
          ) : (
            <div className="tour-overlay__backdrop" />
          )}

          {(() => {
            const mainRect = tourTargetRects[0] ?? null;
            const tooltipClass =
              currentTourStep.placement === "center" || !mainRect
                ? "tour-tooltip tour-tooltip--center"
                : `tour-tooltip tour-tooltip--${currentTourStep.placement ?? "right"}`;
            const tooltipStyle =
              mainRect && currentTourStep.placement !== "center"
                ? (() => {
                    const placement = currentTourStep.placement ?? "right";
                    const gap = 16;
                    if (placement === "right") {
                      return { top: Math.max(16, mainRect.top), left: mainRect.left + mainRect.width + gap };
                    }
                    if (placement === "left") {
                      return { top: Math.max(16, mainRect.top), right: window.innerWidth - mainRect.left + gap };
                    }
                    if (placement === "bottom") {
                      return { top: mainRect.top + mainRect.height + gap, left: Math.max(16, mainRect.left) };
                    }
                    if (placement === "top") {
                      return { bottom: window.innerHeight - mainRect.top + gap, left: Math.max(16, mainRect.left) };
                    }
                    return undefined;
                  })()
                : undefined;
            return (
          <div
            className={tooltipClass}
            style={tooltipStyle}
          >
            <div className="tour-tooltip__head">
              <div className="tour-tooltip__icon-wrap">
                <span className={`codicon ${currentTourStep.icon} tour-tooltip__icon`} aria-hidden="true" />
              </div>
              <div className="tour-tooltip__head-text">
                <strong>{currentTourStep.title}</strong>
                <small>{currentTourStep.summary}</small>
              </div>
              <button
                type="button"
                className="tour-tooltip__close"
                onClick={closeTour}
                aria-label="튜토리얼 종료"
              >
                ×
              </button>
            </div>

            <div className="tour-tooltip__body">
              {currentTourStep.body.map((block, idx) => {
                if (block.kind === "li") {
                  return (
                    <div key={idx} className="tour-tooltip__li">
                      <span className="tour-tooltip__bullet" aria-hidden="true" />
                      <span>{block.text}</span>
                    </div>
                  );
                }
                if (block.kind === "tip") {
                  return (
                    <div key={idx} className="tour-tooltip__tip">
                      <span className="codicon codicon-lightbulb" aria-hidden="true" />
                      <span>{block.text}</span>
                    </div>
                  );
                }
                return (
                  <p key={idx} className="tour-tooltip__p">
                    {block.text}
                  </p>
                );
              })}
            </div>

            <div className="tour-tooltip__footer">
              <span className="tour-tooltip__progress">
                {tourStepIndex + 1} / {tutorialSteps.length}
              </span>
              <div className="tour-tooltip__actions">
                {currentTourStep.action ? (
                  <button
                    type="button"
                    className="tour-tooltip__btn tour-tooltip__btn--ghost"
                    onClick={() => performTourAction(currentTourStep)}
                  >
                    {currentTourStep.action.label}
                  </button>
                ) : null}
                {tourStepIndex > 0 ? (
                  <button
                    type="button"
                    className="tour-tooltip__btn tour-tooltip__btn--ghost"
                    onClick={retreatTour}
                  >
                    이전
                  </button>
                ) : null}
                <button
                  type="button"
                  className="tour-tooltip__btn tour-tooltip__btn--primary"
                  onClick={advanceTour}
                >
                  {tourStepIndex >= tutorialSteps.length - 1 ? "완료" : "다음"}
                </button>
              </div>
            </div>
          </div>
            );
          })()}
        </div>
        );
      })() : null}

      {/* Quick Open — Ctrl+P 빠른 파일 열기 팔레트. Esc 또는 배경 클릭으로 닫힘. */}
      {quickOpenVisible ? (
        <QuickOpenPalette
          files={files.map((f) => f.path)}
          query={quickOpenQuery}
          onQueryChange={setQuickOpenQuery}
          onPick={(path) => {
            setActivePath(path);
            setQuickOpenVisible(false);
          }}
          onClose={() => setQuickOpenVisible(false)}
        />
      ) : null}

      {/* Worktree 미해결 confirm — Agent 요청 전에 검토 대기 중 변경을 미리 알림. */}
      {worktreeConfirm ? (
        <div className="quick-open-backdrop" role="presentation" onClick={() => setWorktreeConfirm(null)}>
          <div className="cheatsheet" role="dialog" aria-label="Worktree 확인" onClick={(e) => e.stopPropagation()}>
            <div className="cheatsheet__head">
              <strong>🔍 검토 대기 중인 변경 {worktreeConfirm.pendingPaths.length}개</strong>
              <button type="button" className="cheatsheet__close" onClick={() => setWorktreeConfirm(null)}>×</button>
            </div>
            <div style={{ padding: "12px 16px" }}>
              <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8, lineHeight: 1.6 }}>
                아직 적용/거절 안 한 AI 변경이 있어요. <strong style={{ color: "var(--text)" }}>같은 경로</strong>를 다시 수정하는 요청이면 이전 변경이 덮어써져요. 다른 경로를 만드는 요청이면 그대로 남아요.
              </p>
              <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0", maxHeight: 200, overflowY: "auto", fontFamily: "var(--font-mono)", fontSize: 11.5 }}>
                {worktreeConfirm.pendingPaths.slice(0, 8).map((p) => (
                  <li key={p} style={{ padding: "3px 0", color: "var(--text)" }}>· {p}</li>
                ))}
                {worktreeConfirm.pendingPaths.length > 8 ? (
                  <li style={{ padding: "3px 0", color: "var(--muted)" }}>... +{worktreeConfirm.pendingPaths.length - 8}개 더</li>
                ) : null}
              </ul>
            </div>
            <div className="cheatsheet__footer" style={{ gap: 8 }}>
              <button
                type="button"
                className="button button--ghost"
                onClick={() => setWorktreeConfirm(null)}
              >
                취소
              </button>
              <button
                type="button"
                className="button button--primary"
                onClick={() => worktreeConfirm.onConfirm()}
              >
                계속
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* 모바일 안내 배너 — viewport < 768 일 때 PC 권장 안내. dismiss 시 세션 동안 비표시. */}
      {viewportSize.width > 0 && viewportSize.width < 768 && !mobileBannerDismissed ? (
        <div className="mobile-banner" role="alert">
          <div className="mobile-banner__icon">💻</div>
          <div className="mobile-banner__body">
            <strong>PC 환경 권장</strong>
            <p>
              AIG IDE 는 PC 가로 화면에 최적화되어 있어요. 모바일 / 태블릿 에선 코드 편집과 AI Pair 가 좁게 보일 수 있어요.
            </p>
          </div>
          <button
            type="button"
            className="mobile-banner__close"
            onClick={() => setMobileBannerDismissed(true)}
            aria-label="배너 닫기"
          >
            ×
          </button>
        </div>
      ) : null}

      {/* 버그 리포트 모달 — 자동으로 컨텍스트(URL, sessionId, UA, viewport) 수집. */}
      {bugReportOpen ? (
        <div className="quick-open-backdrop" role="presentation" onClick={() => setBugReportOpen(false)}>
          <div className="cheatsheet" role="dialog" aria-label="버그 리포트" onClick={(e) => e.stopPropagation()}>
            <div className="cheatsheet__head">
              <strong>🐛 버그 리포트</strong>
              <button type="button" className="cheatsheet__close" onClick={() => setBugReportOpen(false)}>×</button>
            </div>
            <div style={{ padding: "12px 16px" }}>
              <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>
                무엇이 잘못됐는지 짧게 적어주세요. 현재 URL · 세션 ID · 브라우저 정보가 자동 첨부됩니다.
              </p>
              <textarea
                value={bugReportText}
                onChange={(e) => setBugReportText(e.target.value)}
                placeholder="예: Trace detail drawer 가 안 열려요. 클릭해도 반응 없음."
                rows={5}
                style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--ide-border)", background: "var(--ide-surface)", color: "var(--text)", fontFamily: "inherit", fontSize: 12, resize: "vertical" }}
              />
            </div>
            <div className="cheatsheet__footer">
              <button
                type="button"
                className="button button--ghost"
                onClick={() => {
                  const ctx = {
                    description: bugReportText,
                    url: window.location.href,
                    sessionId,
                    userAgent: navigator.userAgent,
                    viewport: `${window.innerWidth}x${window.innerHeight}`,
                    timestamp: new Date().toISOString()
                  };
                  navigator.clipboard.writeText(JSON.stringify(ctx, null, 2)).then(
                    () => {
                      addToast("리포트를 클립보드에 복사했습니다. GitLab 이슈에 붙여넣어 주세요.", "success");
                      setBugReportOpen(false);
                      setBugReportText("");
                    },
                    () => addToast("클립보드 복사 실패", "error")
                  );
                }}
              >
                리포트 복사 (클립보드)
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* 단축키 cheatsheet — Ctrl+/ */}
      {cheatsheetOpen ? (
        <div className="quick-open-backdrop" role="presentation" onClick={() => setCheatsheetOpen(false)}>
          <div className="cheatsheet" role="dialog" aria-label="단축키" onClick={(e) => e.stopPropagation()}>
            <div className="cheatsheet__head">
              <strong>단축키</strong>
              <button type="button" className="cheatsheet__close" onClick={() => setCheatsheetOpen(false)}>×</button>
            </div>
            <div className="cheatsheet__grid">
              <div className="cheatsheet__row"><kbd>Ctrl</kbd>+<kbd>P</kbd><span>빠른 파일 열기</span></div>
              <div className="cheatsheet__row"><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd><span>워크스페이스 검색</span></div>
              <div className="cheatsheet__row"><kbd>Ctrl</kbd>+<kbd>S</kbd><span>현재 파일 저장</span></div>
              <div className="cheatsheet__row"><kbd>Ctrl</kbd>+<kbd>Enter</kbd><span>AI 메시지 전송</span></div>
              <div className="cheatsheet__row"><kbd>Ctrl</kbd>+<kbd>/</kbd><span>이 단축키 표</span></div>
              <div className="cheatsheet__row"><kbd>Esc</kbd><span>모달 / 팔레트 닫기</span></div>
            </div>
            <div className="cheatsheet__hint">Mac 에서는 <kbd>Cmd</kbd> 사용</div>
            <div className="cheatsheet__grid">
              <div className="cheatsheet__row">
                <span>테마</span>
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={toggleTheme}
                  style={{ marginLeft: "auto" }}
                >
                  {theme === "dark" ? "🌙 다크" : "☀️ 라이트"} 전환
                </button>
              </div>
            </div>
            <div className="cheatsheet__footer">
              <button
                type="button"
                className="button button--ghost"
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href).then(
                    () => addToast("현재 페이지 URL 을 복사했습니다.", "success"),
                    () => addToast("URL 복사 실패", "error")
                  );
                }}
              >
                현재 페이지 URL 복사
              </button>
              <button
                type="button"
                className="button button--ghost"
                onClick={() => {
                  setCheatsheetOpen(false);
                  setBugReportOpen(true);
                }}
              >
                🐛 버그 리포트
              </button>
              <button
                type="button"
                className="button button--ghost"
                onClick={() => {
                  handleExportSession();
                  setCheatsheetOpen(false);
                }}
              >
                세션 JSON 으로 export
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ─── Quick Open Palette ──────────────────────────────────────────────────────
// VSCode 식 Ctrl+P. files 의 path 목록을 substring 매칭으로 필터, 위/아래 화살표 + Enter 로 선택.
function QuickOpenPalette({
  files,
  query,
  onQueryChange,
  onPick,
  onClose
}: {
  files: string[];
  query: string;
  onQueryChange: (q: string) => void;
  onPick: (path: string) => void;
  onClose: () => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return files.slice(0, 30);
    // 단순 substring + path 길이 짧은 순 정렬
    return files
      .filter((p) => p.toLowerCase().includes(q))
      .sort((a, b) => a.length - b.length)
      .slice(0, 30);
  }, [files, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const handleKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = filtered[activeIndex];
      if (pick) onPick(pick);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div className="quick-open-backdrop" role="presentation" onClick={onClose}>
      <div className="quick-open" role="dialog" aria-label="파일 빠른 열기" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="quick-open__input"
          placeholder="파일 이름으로 검색…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={handleKey}
        />
        <ul className="quick-open__list">
          {filtered.length === 0 ? (
            <li className="quick-open__empty">매칭되는 파일이 없습니다</li>
          ) : (
            filtered.map((path, idx) => {
              const name = path.split(/[/\\]/).pop();
              const dir = path.slice(0, path.length - (name?.length ?? 0));
              return (
                <li
                  key={path}
                  className={idx === activeIndex ? "quick-open__item quick-open__item--active" : "quick-open__item"}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => onPick(path)}
                >
                  <span className="quick-open__name">{name}</span>
                  {dir ? <span className="quick-open__dir">{dir}</span> : null}
                </li>
              );
            })
          )}
        </ul>
        <div className="quick-open__hint">
          <kbd>↑↓</kbd> 이동 · <kbd>Enter</kbd> 열기 · <kbd>Esc</kbd> 닫기
        </div>
      </div>
    </div>
  );
}

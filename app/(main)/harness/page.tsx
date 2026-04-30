"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  FileText,
  FlaskConical,
  ScrollText,
  Wrench,
  RotateCcw,
  Save,
  Eye,
  Pencil,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  type LucideIcon
} from "lucide-react";

import { useUiStore } from "@/store/uiStore";

/* ─── Agent file defs (mirror /dev/harness) ─── */

type AgentFile = {
  id: "harness" | "instruction" | "sandbox" | "skills";
  label: string;
  path: string;
  tag: "main" | "meta" | "temp";
  icon: LucideIcon;
  summary: string;
  /** Always-on tint for the file icon box (not tied to active state) */
  iconTint: string;
  defaultContent: string;
};

const AGENT_FILES: AgentFile[] = [
  {
    id: "harness",
    label: "HARNESS.md",
    path: "agent/HARNESS.md",
    tag: "main",
    icon: ScrollText,
    summary: "메인 실행 지침 파일",
    iconTint: "bg-indigo-50 text-indigo-600",
    defaultContent: `# Harness

에이전트 실행 환경을 정의하는 파일입니다.

## 목적
- 에이전트가 풀이 세션에서 사용할 기본 지침을 담습니다.
- \`instuction.md\`와 함께 읽힙니다.

## 실행 규칙
- 코드 변경 전 반드시 테스트를 먼저 읽어라.
- 스택 트레이스 전체를 읽고 근본 원인을 파악해라.
- 한 번에 하나의 변경만 하고 결과를 확인해라.
`
  },
  {
    id: "instruction",
    label: "instuction.md",
    path: "agent/instuction.md",
    tag: "meta",
    icon: FileText,
    summary: "메타 지침 및 정책",
    iconTint: "bg-gray-100 text-gray-600",
    defaultContent: `# Instruction

에이전트 행동 지침서입니다.

## 기본 원칙
1. 질문보다 먼저 파일을 읽어라.
2. 가정보다 검증을 우선해라.
3. 에러 메시지를 그대로 사용자에게 전달하지 마라.

## 코딩 규칙
- 한 함수에 하나의 책임만 부여한다.
- 명시적인 예외 처리를 작성한다.
- 테스트 가능한 구조를 유지한다.
`
  },
  {
    id: "sandbox",
    label: ".sandbox/README.md",
    path: "agent/.sandbox/README.md",
    tag: "temp",
    icon: FlaskConical,
    summary: "실험용 샌드박스 안내",
    iconTint: "bg-amber-50 text-amber-600",
    defaultContent: `# Sandbox

에이전트의 임시 작업 공간입니다.

## 용도
- 실험적 코드 스니펫을 임시 저장합니다.
- 풀이 도중 메모할 내용을 남깁니다.
- 세션 종료 시 초기화됩니다.

## 주의
이 파일의 내용은 세션 평가에 포함되지 않습니다.
`
  },
  {
    id: "skills",
    label: "skills/README.md",
    path: "agent/skills/README.md",
    tag: "meta",
    icon: Wrench,
    summary: "사용 가능한 스킬 목록",
    iconTint: "bg-slate-100 text-slate-600",
    defaultContent: `# Skills

에이전트가 사용할 수 있는 스킬 목록입니다.

## 등록된 스킬
- \`read_file\` — 파일 내용을 읽습니다.
- \`write_file\` — 파일에 내용을 씁니다.
- \`run_tests\` — 테스트를 실행하고 결과를 반환합니다.
- \`search_code\` — 코드베이스에서 패턴을 검색합니다.

## 스킬 추가 방법
새 스킬 파일을 \`agent/skills/\` 디렉터리에 추가하고 이 목록을 갱신하세요.
`
  }
];

const TAG_STYLE: Record<AgentFile["tag"], string> = {
  main: "bg-indigo-100 text-indigo-700",
  meta: "bg-gray-100 text-gray-600",
  temp: "bg-amber-100 text-amber-700"
};

const STORAGE_KEY = "aig-harness-files-v1";

/* Glass surface preset (Glassmorphism 2.0) */
const GLASS =
  "bg-white/70 backdrop-blur-md border border-white/70 ring-1 ring-inset ring-white/60 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9),0_1px_2px_rgba(17,24,39,0.04),0_12px_32px_-18px_rgba(79,70,229,0.25)]";

const IDE_TONE = {
  workbench: "#ffffff",
  sidebar: "#ffffff",
  activity: "#eef3ff",
  tab: "#eef3ff",
  tabActive: "#ffffff",
  border: "#d7def3",
  hover: "#eef2ff",
  pill: "#eef2ff",
  status: "#5b4cf0",
  accent: "#6d3df5",
  accentDim: "#eef0ff",
  text: "#1f2937",
  muted: "#71809a",
  muted2: "#9aa6bd",
  code: "#111827",
  codeMuted: "#0f7ea5",
  divider: "#111827"
};

function loadFiles(): Partial<Record<AgentFile["id"], string>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
function saveFiles(files: Record<string, string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
}

/* ─── Page ─── */

export default function Dev2HarnessPage() {
  const addToast = useUiStore((s) => s.addToast);
  const [activeId, setActiveId] = useState<AgentFile["id"]>("harness");
  const [contents, setContents] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"edit" | "preview">("edit");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  const handleEditorScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  /* Load from localStorage */
  useEffect(() => {
    const saved = loadFiles();
    const initial: Record<string, string> = {};
    for (const f of AGENT_FILES) {
      initial[f.id] = saved[f.id] ?? f.defaultContent;
    }
    setContents(initial);
  }, []);

  const activeFile = AGENT_FILES.find((f) => f.id === activeId)!;
  const activeContent = contents[activeId] ?? "";
  const totalDirty = dirty.size;

  const handleContentChange = (value: string) => {
    setContents((prev) => ({ ...prev, [activeId]: value }));
    setDirty((prev) => new Set(prev).add(activeId));
  };

  const handleSaveActive = () => {
    saveFiles(contents);
    setDirty((prev) => {
      const next = new Set(prev);
      next.delete(activeId);
      return next;
    });
    addToast(`${activeFile.label} 저장 완료`, "success");
  };

  const handleSaveAll = () => {
    saveFiles(contents);
    setDirty(new Set());
    addToast(`${totalDirty}개 파일 저장 완료`, "success");
  };

  const handleReset = () => {
    if (
      dirty.has(activeId) &&
      !window.confirm(
        `${activeFile.label}에 저장하지 않은 변경사항이 있습니다. 기본값으로 되돌릴까요?`
      )
    )
      return;
    setContents((prev) => ({ ...prev, [activeId]: activeFile.defaultContent }));
    setDirty((prev) => new Set(prev).add(activeId));
    addToast(`${activeFile.label}을 기본값으로 되돌렸습니다.`, "success");
  };

  /* Line count for meta display */
  const lineCount = useMemo(() => activeContent.split("\n").length, [activeContent]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#EEF2FF]">
      {/* ─── Aurora / Mesh background ─── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {/* Base mesh wash */}
        {/* Background grid */}
        {/* Grid pattern overlay */}
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.18]" />
        {/* Bottom fade to solid surface */}
        <div className="absolute inset-x-0 bottom-0 h-[30vh] bg-gradient-to-b from-transparent to-slate-50" />
      </div>

      <div className="relative max-w-6xl mx-auto px-6 pt-28 pb-16 space-y-6">
        {/* ── HEADER ── */}
        <section className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 animate-slide-up">
          <div className="min-w-0">
            <h1 className="text-4xl md:text-5xl font-display font-bold text-gray-900 tracking-tight leading-[1.05] mb-3 text-balance">
              에이전트 실행 환경 관리
            </h1>
            <p className="text-[15px] text-gray-500 leading-relaxed max-w-2xl">
              에이전트가 세션에서 읽는 지침·행동 규칙·스킬 파일을 직접 수정합니다.
              저장된 내용은 새 풀이 세션부터 즉시 반영돼요.
            </p>
          </div>

          <div className="shrink-0" />
        </section>

        {/* ── EDITOR BODY (VS Code style) ── */}
        <section className="relative">
          <div
            className="rounded-xl overflow-hidden border-4 shadow-[0_0_0_1px_rgba(0,0,0,0.95),0_24px_60px_-24px_rgba(79,70,229,0.28)]"
            style={{ backgroundColor: IDE_TONE.workbench, borderColor: "#020617" }}
          >
            {/* Window titlebar — VS Code on Windows style */}
            <div
              className="flex items-center h-8 border-b select-none"
              style={{ backgroundColor: IDE_TONE.activity, borderColor: IDE_TONE.divider }}
            >
              {/* Center: title + save status */}
              <div className="flex-1 flex items-center justify-center gap-2 min-w-0 px-4">
                  <span className="text-[12px] font-mono font-semibold truncate" style={{ color: IDE_TONE.text }}>
                    {activeFile.path}
                  </span>
                {totalDirty > 0 && (
                  <span className="text-[11px] text-amber-400 shrink-0">●</span>
                )}
              </div>

              {/* Right: save + Windows-style controls */}
              <div className="flex items-stretch h-full shrink-0">
                {totalDirty > 0 && (
                  <button
                    type="button"
                    onClick={handleSaveAll}
                    className="flex items-center gap-1 px-3 h-full text-[11px] text-amber-300 hover:bg-amber-400/20 transition-colors font-mono"
                  >
                    <Save size={10} strokeWidth={2.5} />
                    {totalDirty}개 저장
                  </button>
                )}
                {/* Minimize — horizontal line */}
                <button
                  type="button"
                  aria-label="최소화"
                  className="flex items-center justify-center w-11 h-full transition-colors"
                  style={{ color: IDE_TONE.muted }}
                >
                  <svg width="10" height="1" viewBox="0 0 10 1" fill="none">
                    <rect width="10" height="1" fill="currentColor" />
                  </svg>
                </button>
                {/* Restore — square outline */}
                <button
                  type="button"
                  aria-label="최대화"
                  className="flex items-center justify-center w-11 h-full transition-colors"
                  style={{ color: IDE_TONE.muted }}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <rect x="0.5" y="0.5" width="9" height="9" stroke="currentColor" strokeWidth="1" />
                  </svg>
                </button>
                {/* Close — X */}
                <button
                  type="button"
                  aria-label="닫기"
                  className="flex items-center justify-center w-11 h-full transition-colors group"
                  style={{ color: IDE_TONE.muted }}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className="group-hover:stroke-white" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex" style={{ minHeight: "560px" }}>
              {/* ── Explorer sidebar ── */}
              <div
                className="w-52 shrink-0 flex flex-col border-r-2"
                style={{ backgroundColor: IDE_TONE.sidebar, borderColor: IDE_TONE.divider }}
              >
                {/* Explorer header */}
                <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: IDE_TONE.divider }}>
                  <span className="text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: IDE_TONE.text }}>
                    Explorer
                  </span>
                  <span className="text-[10px] font-mono tabular-nums" style={{ color: IDE_TONE.muted2 }}>
                    {AGENT_FILES.length} files
                  </span>
                </div>

                {/* Workspace folder */}
                <div className="py-1">
                  {/* Folder row */}
                  <div className="flex items-center gap-1 px-2 py-1 select-none" style={{ color: IDE_TONE.text }}>
                    <ChevronDown size={13} className="shrink-0" style={{ color: IDE_TONE.muted }} />
                    <FolderOpen size={13} className="shrink-0" style={{ color: "#5b8dff" }} />
                    <span className="text-[11px] font-bold uppercase tracking-wide ml-0.5" style={{ color: IDE_TONE.text }}>
                      agent
                    </span>
                  </div>

                  {/* File rows */}
                  {AGENT_FILES.map((file) => {
                    const active = activeId === file.id;
                    const isDirty = dirty.has(file.id);
                    const Icon = file.icon;
                    const tagColors: Record<AgentFile["tag"], string> = {
                      main: "text-sky-400",
                      meta: "text-slate-400",
                      temp: "text-violet-400"
                    };
                    return (
                      <button
                        key={file.id}
                        type="button"
                        onClick={() => setActiveId(file.id)}
                        className="w-full flex items-center gap-2 pl-7 pr-3 py-[5px] text-left text-[13px] font-mono transition-colors"
                        style={{
                          backgroundColor: active ? IDE_TONE.accentDim : "transparent",
                          color: active ? IDE_TONE.text : IDE_TONE.muted
                        }}
                      >
                        <Icon
                          size={14}
                          strokeWidth={1.8}
                          className={`shrink-0 ${active ? "" : tagColors[file.tag]}`}
                          style={active ? { color: IDE_TONE.accent } : undefined}
                        />
                        <span className="flex-1 truncate">{file.label}</span>
                        {isDirty && (
                          <span
                            className="w-2 h-2 rounded-full bg-amber-400 shrink-0"
                            title="저장 안 됨"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* File summary at bottom */}
                <div className="mt-auto border-t p-3" style={{ borderColor: IDE_TONE.divider }}>
                  <div className="text-[11px] font-mono mb-1 uppercase tracking-wider" style={{ color: IDE_TONE.muted2 }}>
                    선택됨
                  </div>
                  <div className="text-[11px] leading-relaxed" style={{ color: IDE_TONE.muted }}>
                    {activeFile.summary}
                  </div>
                  <span
                    className={`inline-block mt-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${TAG_STYLE[activeFile.tag]}`}
                  >
                    {activeFile.tag}
                  </span>
                </div>
              </div>

              {/* ── Editor panel ── */}
              <div className="flex-1 flex flex-col min-w-0" style={{ backgroundColor: IDE_TONE.workbench }}>
                {/* Tab bar */}
                <div
                  className="flex items-stretch border-b"
                  style={{ backgroundColor: IDE_TONE.tab, borderColor: IDE_TONE.divider }}
                >
                  {AGENT_FILES.map((file) => {
                    const active = activeId === file.id;
                    const isDirty = dirty.has(file.id);
                    return (
                      <button
                        key={file.id}
                        type="button"
                        onClick={() => setActiveId(file.id)}
                        className="relative flex items-center gap-2 px-4 py-2 text-[12px] font-mono whitespace-nowrap border-r border-b transition-colors"
                        style={{
                          backgroundColor: active ? IDE_TONE.tabActive : "transparent",
                          borderColor: IDE_TONE.divider,
                          color: active ? IDE_TONE.text : IDE_TONE.muted
                        }}
                      >
                        {/* Active top border */}
                        {active && (
                          <span className="absolute inset-x-0 top-0 h-[2px]" style={{ backgroundColor: IDE_TONE.accent }} />
                        )}
                        <span>{file.label}</span>
                        {isDirty && (
                          <span className="w-2 h-2 rounded-full opacity-80 shrink-0" style={{ backgroundColor: IDE_TONE.muted }} />
                        )}
                      </button>
                    );
                  })}

                  {/* Actions pushed to right */}
                  <div className="ml-auto flex items-center gap-1 px-3 shrink-0">
                    <div className="flex items-center rounded overflow-hidden" style={{ boxShadow: `0 0 0 1px ${IDE_TONE.divider}` }}>
                      <button
                        type="button"
                        onClick={() => setViewMode("edit")}
                        title="편집 모드"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] transition-colors"
                        style={{
                          backgroundColor: viewMode === "edit" ? IDE_TONE.accent : IDE_TONE.pill,
                          color: viewMode === "edit" ? "#ffffff" : IDE_TONE.muted
                        }}
                      >
                        <Pencil size={11} strokeWidth={2.4} />
                        편집
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode("preview")}
                        title="미리보기"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] transition-colors border-l"
                        style={{
                          backgroundColor: viewMode === "preview" ? IDE_TONE.accent : IDE_TONE.pill,
                          borderColor: IDE_TONE.divider,
                          color: viewMode === "preview" ? "#ffffff" : IDE_TONE.muted
                        }}
                      >
                        <Eye size={11} strokeWidth={2.4} />
                        미리보기
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={handleReset}
                      title="기본값으로 초기화"
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded text-[11px] transition-colors"
                      style={{ color: IDE_TONE.muted }}
                    >
                      <RotateCcw size={11} strokeWidth={2.4} />
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveActive}
                      disabled={!dirty.has(activeId)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] font-semibold text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
                      style={{ backgroundColor: IDE_TONE.accent }}
                    >
                      <Save size={11} strokeWidth={2.5} />
                      저장
                    </button>
                  </div>
                </div>

                {/* Breadcrumb */}
                <div
                  className="flex items-center gap-1 px-4 py-1.5 text-[11px] font-mono border-y"
                  style={{ backgroundColor: IDE_TONE.workbench, borderColor: IDE_TONE.divider, color: IDE_TONE.muted }}
                >
                  <span>agent</span>
                  <ChevronRight size={11} style={{ color: IDE_TONE.muted2 }} />
                  <span style={{ color: IDE_TONE.text }}>{activeFile.label}</span>
                  {dirty.has(activeId) && (
                    <>
                      <span className="mx-2" style={{ color: IDE_TONE.divider }}>·</span>
                      <span className="text-amber-400">수정됨</span>
                    </>
                  )}
                </div>

                {/* Editor body */}
                {viewMode === "edit" ? (
                  <div className="flex flex-1 overflow-hidden" style={{ minHeight: "460px" }}>
                    {/* Line numbers */}
                    <div
                      ref={lineNumbersRef}
                      className="overflow-hidden select-none shrink-0 text-right pt-4 pb-4 pr-3 font-mono text-[13px] leading-6"
                      style={{ backgroundColor: IDE_TONE.workbench, color: IDE_TONE.muted, minWidth: "48px" }}
                    >
                      {activeContent.split("\n").map((_, i) => (
                        <div key={i} style={{ lineHeight: "24px" }}>
                          {i + 1}
                        </div>
                      ))}
                    </div>
                    {/* Code textarea */}
                    <textarea
                      ref={textareaRef}
                      value={activeContent}
                      onChange={(e) => handleContentChange(e.target.value)}
                      onScroll={handleEditorScroll}
                      spellCheck={false}
                      style={{
                        caretColor: IDE_TONE.accent,
                        color: IDE_TONE.code,
                        lineHeight: "24px",
                        backgroundColor: IDE_TONE.workbench
                      }}
                      className="flex-1 font-mono text-[13px] outline-none border-0 resize-none pt-4 pb-4 pr-6 overflow-y-auto selection:bg-indigo-200 selection:text-gray-950"
                    />
                  </div>
                ) : (
                  <div
                    className="flex-1 px-10 py-6 overflow-auto"
                    style={{ minHeight: "460px", backgroundColor: IDE_TONE.workbench }}
                  >
                    <div
                      className="text-[14px] text-gray-800 leading-relaxed
                        [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-gray-950 [&_h1]:mb-4 [&_h1]:mt-0 [&_h1]:pb-2 [&_h1]:border-b [&_h1]:border-indigo-100
                        [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-gray-950 [&_h2]:mt-6 [&_h2]:mb-2.5
                        [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-gray-700 [&_h3]:mt-4 [&_h3]:mb-2
                        [&_p]:mb-3 [&_p]:text-gray-700
                        [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_ul]:mb-3 [&_ul>li]:list-disc [&_ul>li]:marker:text-indigo-400
                        [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:space-y-1 [&_ol]:mb-3 [&_ol]:marker:text-slate-400
                        [&_code]:bg-indigo-50 [&_code]:text-violet-700 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[13px] [&_code]:font-mono [&_code]:ring-1 [&_code]:ring-indigo-100
                        [&_pre]:bg-slate-50 [&_pre]:text-gray-800 [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:my-3 [&_pre]:ring-1 [&_pre]:ring-indigo-100 [&_pre_code]:bg-transparent [&_pre_code]:text-inherit [&_pre_code]:p-0 [&_pre_code]:ring-0
                        [&_blockquote]:border-l-4 [&_blockquote]:border-indigo-500 [&_blockquote]:pl-4 [&_blockquote]:py-0.5 [&_blockquote]:my-3 [&_blockquote]:text-slate-500 [&_blockquote]:italic
                        [&_hr]:my-5 [&_hr]:border-t [&_hr]:border-indigo-100
                        [&_strong]:font-bold [&_strong]:text-gray-950
                        [&_a]:text-indigo-400 [&_a]:underline [&_a]:underline-offset-2"
                    >
                      <Markdown remarkPlugins={[remarkGfm]}>
                        {activeContent || "*내용이 비어있습니다*"}
                      </Markdown>
                    </div>
                  </div>
                )}

                {/* Status bar */}
                <div
                  className="flex items-center justify-between px-4 h-6 text-white text-[11px] font-mono shrink-0 border-t"
                  style={{ backgroundColor: IDE_TONE.status, borderColor: IDE_TONE.divider }}
                >
                  <div className="flex items-center gap-4">
                    <span>Markdown</span>
                    <span className="text-white/75">{activeFile.path}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    {dirty.has(activeId) && (
                      <span className="text-amber-300">● 저장 안 됨</span>
                    )}
                    <span>Ln 1 — {lineCount} lines</span>
                    <span>UTF-8</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── INFO BANNER (glass) ── */}
        <section className={`rounded-2xl px-5 py-4 ${GLASS}`}>
          <div className="text-sm text-gray-700 leading-relaxed">
            <strong className="font-bold text-gray-900">실행 환경 안내 · </strong>
            <code className="font-mono text-xs bg-white/70 ring-1 ring-white/80 px-1.5 py-0.5 rounded">HARNESS.md</code>
            <span className="mx-1">+</span>
            <code className="font-mono text-xs bg-white/70 ring-1 ring-white/80 px-1.5 py-0.5 rounded">instuction.md</code>
            는 모든 세션의 에이전트 프롬프트에 주입됩니다.
            <code className="font-mono text-xs bg-white/70 ring-1 ring-white/80 px-1.5 py-0.5 rounded ml-1">.sandbox</code>는
            실험용이며 세션 평가·리포트 생성에 영향을 주지 않아요.
            API 키 관리는{" "}
            <a
              href="mypage"
              className="underline font-semibold text-indigo-700 hover:text-indigo-900 decoration-indigo-300 hover:decoration-indigo-500 underline-offset-2"
            >
              마이페이지
            </a>
            에서 할 수 있습니다.
          </div>
        </section>
      </div>
    </div>
  );
}

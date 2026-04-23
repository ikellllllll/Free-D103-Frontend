"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  FileText,
  FlaskConical,
  ScrollText,
  Wrench,
  Check,
  RotateCcw,
  Save,
  Eye,
  Pencil,
  AlertTriangle,
  Info,
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

/* Shared spring easing used across hover/active states */
const SPRING = "transition-[transform,box-shadow,background-color,color,border-color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]";

/* Glass surface preset (Glassmorphism 2.0) */
const GLASS =
  "bg-white/70 backdrop-blur-md border border-white/70 ring-1 ring-inset ring-white/60 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9),0_1px_2px_rgba(17,24,39,0.04),0_12px_32px_-18px_rgba(79,70,229,0.25)]";

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
    <div className="relative min-h-screen overflow-hidden bg-slate-50">
      {/* ─── Aurora / Mesh background ─── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {/* Base mesh wash */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_20%_-10%,rgba(99,102,241,0.22),transparent_60%),radial-gradient(ellipse_70%_55%_at_85%_5%,rgba(217,70,239,0.18),transparent_60%),radial-gradient(ellipse_60%_45%_at_50%_100%,rgba(56,189,248,0.14),transparent_60%)]" />
        {/* Aurora blobs */}
        <div className="absolute -top-24 -left-32 w-[520px] h-[520px] rounded-full bg-indigo-400/25 blur-3xl animate-blob-1" />
        <div className="absolute top-[6%] -right-36 w-[520px] h-[520px] rounded-full bg-fuchsia-400/20 blur-3xl animate-blob-2" />
        <div className="absolute top-[35%] left-[30%] w-[420px] h-[420px] rounded-full bg-violet-400/18 blur-3xl animate-blob-1" style={{ animationDelay: "-3s" }} />
        {/* Grid pattern overlay */}
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.18]" />
        {/* Bottom fade to solid surface */}
        <div className="absolute inset-x-0 bottom-0 h-[30vh] bg-gradient-to-b from-transparent to-slate-50" />
      </div>

      <div className="relative max-w-6xl mx-auto px-6 pt-28 pb-16 space-y-6">
        {/* ── HEADER ── */}
        <section className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 animate-slide-up">
          <div className="min-w-0">
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${GLASS} text-indigo-700 text-xs font-bold uppercase tracking-[0.14em] mb-4`}>
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-indigo-500 opacity-60 animate-ping" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-indigo-600" />
              </span>
              <span>Agent Harness</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-display font-bold text-gray-900 tracking-tight leading-[1.05] mb-3 text-balance">
              에이전트 실행 환경 관리
            </h1>
            <p className="text-[15px] text-gray-500 leading-relaxed max-w-2xl">
              에이전트가 세션에서 읽는 지침·행동 규칙·스킬 파일을 직접 수정합니다.
              저장된 내용은 새 풀이 세션부터 즉시 반영돼요.
            </p>
          </div>

          {/* Save-all pill */}
          <div className="flex items-center gap-3 shrink-0">
            <div
              className={`inline-flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-bold ${GLASS} ${SPRING} ${
                totalDirty > 0 ? "text-amber-700" : "text-emerald-700"
              }`}
            >
              {totalDirty > 0 ? (
                <>
                  <AlertTriangle size={14} strokeWidth={2.6} />
                  <span className="tabular-nums">{totalDirty}개 미저장</span>
                </>
              ) : (
                <>
                  <Check size={14} strokeWidth={2.8} />
                  <span>모두 저장됨</span>
                </>
              )}
            </div>
            {totalDirty > 0 && (
              <button
                type="button"
                onClick={handleSaveAll}
                className={`inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold text-white ${SPRING}
                  bg-gradient-to-br from-indigo-500 via-violet-600 to-fuchsia-600
                  shadow-[0_10px_24px_-10px_rgba(79,70,229,0.55),inset_0_1px_0_0_rgba(255,255,255,0.35)]
                  hover:-translate-y-0.5 hover:shadow-[0_18px_36px_-14px_rgba(79,70,229,0.6),inset_0_1px_0_0_rgba(255,255,255,0.45)]
                  active:translate-y-0 active:scale-[0.98]`}
              >
                <Save size={16} strokeWidth={2.6} />
                <span>전체 저장</span>
              </button>
            )}
          </div>
        </section>

        {/* ── EDITOR BODY ── */}
        <section className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5">
          {/* Left: File list (glass) */}
          <aside className={`rounded-2xl overflow-hidden self-start ${GLASS}`}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/60">
              <span className="font-display font-bold text-gray-900">에이전트 파일</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/70 text-gray-700 ring-1 ring-white/80 tabular-nums">
                {AGENT_FILES.length}
              </span>
            </div>
            <div className="py-2">
              {AGENT_FILES.map((file) => {
                const active = activeId === file.id;
                const Icon = file.icon;
                const isDirty = dirty.has(file.id);
                return (
                  <button
                    key={file.id}
                    type="button"
                    onClick={() => setActiveId(file.id)}
                    className={`relative w-full flex items-start gap-3 px-5 py-3 text-left ${SPRING}
                      ${active
                        ? "bg-gradient-to-r from-indigo-50 via-violet-50 to-white"
                        : "hover:bg-white/60 active:scale-[0.995]"
                      }`}
                  >
                    {active && (
                      <span
                        className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-gradient-to-b from-indigo-500 to-fuchsia-500"
                        aria-hidden="true"
                      />
                    )}
                    <span
                      className={`shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-xl ${file.iconTint} ${SPRING}
                        ring-1 ring-white/70
                        shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9),0_4px_12px_-6px_rgba(79,70,229,0.2)]
                        ${active ? "scale-[1.03]" : "group-hover:scale-[1.02]"}`}
                    >
                      <Icon size={18} strokeWidth={2.2} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-mono text-[13px] font-semibold truncate ${
                            active ? "text-indigo-900" : "text-gray-900"
                          }`}
                        >
                          {file.label}
                        </span>
                        {isDirty && (
                          <span
                            className="relative shrink-0 w-1.5 h-1.5 rounded-full bg-amber-500"
                            title="저장 안 됨"
                          >
                            <span className="absolute inset-0 rounded-full bg-amber-400 opacity-70 animate-ping" />
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 truncate">
                        {file.summary}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 self-start mt-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${TAG_STYLE[file.tag]}`}
                    >
                      {file.tag}
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Right: Editor (glass) */}
          <section className={`rounded-2xl overflow-hidden ${GLASS}`}>
            {/* Path header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/60 gap-3 flex-wrap bg-white/40 backdrop-blur-sm">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="flex items-center gap-1 shrink-0" aria-hidden="true">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-400/70" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
                </span>
                <code className="font-mono text-sm text-gray-700 font-semibold truncate">
                  {activeFile.path}
                </code>
                {dirty.has(activeId) && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full ring-1 ring-amber-200/60">
                    <span className="w-1 h-1 rounded-full bg-amber-600" />
                    unsaved
                  </span>
                )}
                <span className="text-xs text-gray-400 tabular-nums">
                  {lineCount} lines
                </span>
              </div>
              <div className="flex items-center gap-2">
                {/* View mode — segmented control */}
                <div className="relative inline-flex rounded-xl bg-white/70 p-0.5 ring-1 ring-inset ring-white/70 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9),0_1px_2px_rgba(17,24,39,0.04)]">
                  <span
                    className={`absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] rounded-lg bg-gradient-to-br from-white to-indigo-50 ring-1 ring-white shadow-[0_6px_14px_-8px_rgba(79,70,229,0.35)] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                      viewMode === "preview" ? "translate-x-full" : "translate-x-0"
                    }`}
                    aria-hidden="true"
                  />
                  <button
                    type="button"
                    onClick={() => setViewMode("edit")}
                    className={`relative z-10 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${SPRING} ${
                      viewMode === "edit" ? "text-indigo-700" : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <Pencil size={12} strokeWidth={2.6} />
                    <span>편집</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("preview")}
                    className={`relative z-10 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${SPRING} ${
                      viewMode === "preview" ? "text-indigo-700" : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <Eye size={12} strokeWidth={2.6} />
                    <span>미리보기</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleReset}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/70 ring-1 ring-inset ring-white/70 text-gray-600 text-xs font-semibold ${SPRING} hover:-translate-y-0.5 hover:bg-white hover:text-gray-800 active:translate-y-0 active:scale-[0.97]`}
                  title="기본값으로 초기화"
                >
                  <RotateCcw size={12} strokeWidth={2.6} />
                  <span>초기화</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveActive}
                  disabled={!dirty.has(activeId)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white text-xs font-bold ${SPRING}
                    bg-gradient-to-br from-indigo-500 via-violet-600 to-fuchsia-600
                    shadow-[0_8px_18px_-10px_rgba(79,70,229,0.55),inset_0_1px_0_0_rgba(255,255,255,0.35)]
                    hover:-translate-y-0.5 hover:shadow-[0_14px_28px_-12px_rgba(79,70,229,0.6),inset_0_1px_0_0_rgba(255,255,255,0.45)]
                    active:translate-y-0 active:scale-[0.97]
                    disabled:opacity-40 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-none disabled:bg-none disabled:bg-gray-300`}
                >
                  <Save size={12} strokeWidth={2.6} />
                  <span>저장</span>
                </button>
              </div>
            </div>

            {/* Body */}
            {viewMode === "edit" ? (
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={activeContent}
                  onChange={(e) => handleContentChange(e.target.value)}
                  spellCheck={false}
                  className="w-full min-h-[520px] px-6 py-5 font-mono text-[13px] leading-6 text-gray-800 bg-white/50 backdrop-blur-sm outline-none resize-none focus:bg-white transition-colors duration-300"
                />
              </div>
            ) : (
              <div className="px-6 py-6 min-h-[520px] bg-white/60 backdrop-blur-sm">
                <div
                  className="prose-mini text-[14px] text-gray-800 leading-relaxed
                    [&_h1]:text-3xl [&_h1]:font-display [&_h1]:font-bold [&_h1]:text-gray-900 [&_h1]:mb-4 [&_h1]:mt-0 [&_h1]:tracking-tight
                    [&_h1]:before:content-['#'] [&_h1]:before:text-indigo-400 [&_h1]:before:mr-2 [&_h1]:before:font-normal
                    [&_h2]:text-lg [&_h2]:font-display [&_h2]:font-bold [&_h2]:text-gray-900 [&_h2]:mt-6 [&_h2]:mb-2.5
                    [&_h2]:before:content-['##'] [&_h2]:before:text-indigo-300 [&_h2]:before:mr-2 [&_h2]:before:font-normal [&_h2]:before:text-sm
                    [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-gray-900 [&_h3]:mt-4 [&_h3]:mb-2
                    [&_p]:mb-2.5
                    [&_ul]:list-none [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_ul]:mb-3 [&_ul>li]:pl-2 [&_ul>li]:relative [&_ul>li]:before:content-[''] [&_ul>li]:before:absolute [&_ul>li]:before:left-0 [&_ul>li]:before:top-[10px] [&_ul>li]:before:w-1.5 [&_ul>li]:before:h-1.5 [&_ul>li]:before:rounded-full [&_ul>li]:before:bg-indigo-500
                    [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:space-y-1 [&_ol]:mb-2.5
                    [&_code]:bg-indigo-50 [&_code]:text-indigo-700 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[13px] [&_code]:font-mono
                    [&_pre]:bg-gray-900 [&_pre]:text-gray-100 [&_pre]:p-4 [&_pre]:rounded-xl [&_pre]:overflow-x-auto [&_pre]:my-3 [&_pre_code]:bg-transparent [&_pre_code]:text-inherit [&_pre_code]:p-0
                    [&_a]:text-indigo-600 [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-indigo-700
                    [&_blockquote]:border-l-4 [&_blockquote]:border-indigo-200 [&_blockquote]:pl-4 [&_blockquote]:py-0.5 [&_blockquote]:my-3 [&_blockquote]:text-gray-600 [&_blockquote]:italic
                    [&_hr]:my-5 [&_hr]:border-t [&_hr]:border-gray-200
                    [&_strong]:font-bold [&_strong]:text-gray-900
                    [&_em]:italic
                    [&_del]:line-through [&_del]:text-gray-500
                    [&_table]:w-full [&_table]:my-3 [&_table]:border-collapse [&_table]:rounded-lg [&_table]:overflow-hidden [&_table]:border [&_table]:border-gray-200
                    [&_th]:bg-gray-50 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:text-gray-700 [&_th]:text-xs [&_th]:uppercase [&_th]:tracking-wider [&_th]:border-b [&_th]:border-gray-200
                    [&_td]:px-3 [&_td]:py-2 [&_td]:border-b [&_td]:border-gray-100 [&_tr:last-child_td]:border-b-0
                    [&_input[type=checkbox]]:mr-2 [&_input[type=checkbox]]:accent-indigo-600
                    [&_.task-list-item]:pl-0 [&_.task-list-item]:before:content-none [&_.contains-task-list]:pl-0"
                >
                  <Markdown remarkPlugins={[remarkGfm]}>
                    {activeContent || "*내용이 비어있습니다*"}
                  </Markdown>
                </div>
              </div>
            )}
          </section>
        </section>

        {/* ── INFO BANNER (glass) ── */}
        <section className={`rounded-2xl px-5 py-4 flex items-start gap-3 ${GLASS}`}>
          <span className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white ring-1 ring-white/70 shadow-[0_8px_18px_-10px_rgba(79,70,229,0.55),inset_0_1px_0_0_rgba(255,255,255,0.45)]">
            <Info size={15} strokeWidth={2.4} />
          </span>
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

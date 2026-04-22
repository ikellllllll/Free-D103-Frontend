"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  FileText,
  FlaskConical,
  Sparkles,
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
    <div className="relative bg-gradient-to-b from-indigo-50/30 via-white to-white min-h-screen overflow-hidden">
      {/* Floating orbs */}
      <div className="absolute top-0 left-0 right-0 h-[700px] pointer-events-none overflow-hidden">
        <div className="absolute -top-10 -left-40 w-[460px] h-[460px] rounded-full bg-indigo-400/25 blur-3xl animate-blob-1" />
        <div className="absolute top-[10%] -right-40 w-[460px] h-[460px] rounded-full bg-violet-400/25 blur-3xl animate-blob-2" />
        <div className="absolute inset-0 bg-grid-pattern opacity-25" />
      </div>

      <div className="relative max-w-6xl mx-auto px-6 pt-28 pb-16 space-y-6">
        {/* ── HEADER ── */}
        <section className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 animate-slide-up">
          <div className="min-w-0">
            <div className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-white border border-indigo-100 text-indigo-700 text-xs font-semibold mb-4 shadow-sm">
              <Sparkles size={12} strokeWidth={2.4} />
              <span>Agent Harness</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-display font-bold text-gray-900 tracking-tight leading-[1.05] mb-3">
              에이전트 실행 환경 관리
            </h1>
            <p className="text-[15px] text-gray-500 leading-relaxed max-w-2xl">
              에이전트가 세션에서 읽는 지침·행동 규칙·스킬 파일을 직접 수정합니다.
              저장된 내용은 새 풀이 세션부터 즉시 반영돼요.
            </p>
          </div>

          {/* Save all */}
          <div className="flex items-center gap-3 shrink-0">
            <div
              className={`inline-flex items-center gap-2 px-5 py-3.5 rounded-2xl text-sm font-bold border-2 ${
                totalDirty > 0
                  ? "bg-amber-50 border-amber-200 text-amber-700"
                  : "bg-green-50 border-green-200 text-green-700"
              }`}
            >
              {totalDirty > 0 ? (
                <>
                  <AlertTriangle size={14} strokeWidth={2.4} />
                  <span>{totalDirty}개 미저장</span>
                </>
              ) : (
                <>
                  <Check size={14} strokeWidth={2.4} />
                  <span>모두 저장됨</span>
                </>
              )}
            </div>
            {totalDirty > 0 && (
              <button
                type="button"
                onClick={handleSaveAll}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-md hover:shadow-lg transition-all"
              >
                <Save size={16} strokeWidth={2.4} />
                <span>전체 저장</span>
              </button>
            )}
          </div>
        </section>

        {/* ── EDITOR BODY ── */}
        <section className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5">
          {/* Left: File list */}
          <aside className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden self-start">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <span className="font-display font-bold text-gray-900">Agent Files</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                {AGENT_FILES.length}
              </span>
            </div>
            <div className="py-2">
              {AGENT_FILES.map((file) => {
                const active = activeId === file.id;
                const Icon = file.icon;
                const isDirty = dirty.has(file.id);
                return (
                  <div key={file.id}>
                    <button
                      type="button"
                      onClick={() => setActiveId(file.id)}
                      className={`relative w-full flex items-start gap-3 px-5 py-3 text-left transition-colors ${
                        active ? "bg-indigo-50/60" : "hover:bg-gray-50"
                      }`}
                    >
                      {active && (
                        <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-indigo-500" />
                      )}
                      <span
                        className={`shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-xl ${file.iconTint}`}
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
                              className="shrink-0 w-1.5 h-1.5 rounded-full bg-amber-500"
                              title="저장 안 됨"
                            />
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
                  </div>
                );
              })}
            </div>
          </aside>

          {/* Right: Editor */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Path header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 gap-3 flex-wrap">
              <div className="flex items-center gap-2.5 min-w-0">
                <code className="font-mono text-sm text-gray-700 font-semibold truncate">
                  {activeFile.path}
                </code>
                {dirty.has(activeId) && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                    <span className="w-1 h-1 rounded-full bg-amber-600" />
                    unsaved
                  </span>
                )}
                <span className="text-xs text-gray-400 tabular-nums">
                  {lineCount} lines
                </span>
              </div>
              <div className="flex items-center gap-2">
                {/* View mode toggle */}
                <div className="inline-flex rounded-xl bg-gray-100 p-0.5">
                  <button
                    type="button"
                    onClick={() => setViewMode("edit")}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      viewMode === "edit"
                        ? "bg-white text-indigo-700 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <Pencil size={12} strokeWidth={2.4} />
                    <span>편집</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("preview")}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      viewMode === "preview"
                        ? "bg-white text-indigo-700 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <Eye size={12} strokeWidth={2.4} />
                    <span>미리보기</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 text-xs font-semibold transition-colors"
                  title="기본값으로 초기화"
                >
                  <RotateCcw size={12} strokeWidth={2.4} />
                  <span>초기화</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveActive}
                  disabled={!dirty.has(activeId)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-indigo-600"
                >
                  <Save size={12} strokeWidth={2.4} />
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
                  className="w-full min-h-[520px] px-6 py-5 font-mono text-[13px] leading-6 text-gray-800 bg-white outline-none resize-none"
                />
              </div>
            ) : (
              <div className="px-6 py-6 min-h-[520px]">
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

        {/* ── INFO BANNER ── */}
        <section className="bg-indigo-50/60 border border-indigo-100 rounded-2xl px-5 py-4 flex items-start gap-3">
          <span className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg bg-white text-indigo-600 shadow-sm">
            <Info size={15} strokeWidth={2.2} />
          </span>
          <div className="text-sm text-indigo-900/80 leading-relaxed">
            <strong className="font-semibold text-indigo-900">실행 환경 안내 · </strong>
            <code className="font-mono text-xs bg-white px-1.5 py-0.5 rounded">HARNESS.md</code>
            <span className="mx-1">+</span>
            <code className="font-mono text-xs bg-white px-1.5 py-0.5 rounded">instuction.md</code>
            는 모든 세션의 에이전트 프롬프트에 주입됩니다.
            <code className="font-mono text-xs bg-white px-1.5 py-0.5 rounded">.sandbox</code>는
            실험용이며 세션 평가·리포트 생성에 영향을 주지 않아요.
            API 키 관리는{" "}
            <a
              href="mypage"
              className="underline font-semibold hover:text-indigo-700"
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

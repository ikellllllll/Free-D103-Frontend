"use client";

import React from "react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Markdown from "react-markdown";
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Clock,
  Rocket,
  AlertTriangle,
  Check,
  Info,
  ChevronDown,
  Copy,
  Check as CheckIcon
} from "lucide-react";

import { LangIcon } from "@/components/common/LangIcon";
import { useRouteScope } from "@/components/routing/RouteScopeProvider";
import { mockApi } from "@/lib/api/mockApi";
import { problemApi } from "@/lib/api/problemApi";
import { isBackendProblemId, sessionApi } from "@/lib/api/sessionApi";
import type { ProblemLanguage } from "@/lib/types/session";
import { useAuthStore } from "@/store/authStore";
import { useUiStore } from "@/store/uiStore";

const LANG_OPTIONS: { value: ProblemLanguage; label: string; desc: string }[] = [
  { value: "java", label: "Java", desc: "Spring Boot · JPA" },
  { value: "python", label: "Python", desc: "FastAPI · Pydantic" }
];

const BYOK_STORAGE_KEY = "aig-byok-keys-v1";

type ModelOption = { id: string; label: string; note: string; provider: string };

const MODEL_OPTIONS: Record<string, ModelOption[]> = {
  default: [
    { id: "aig-default", label: "AIG 기본 모델", note: "시스템 제공", provider: "default" }
  ],
  anthropic: [
    { id: "claude-opus-4-6", label: "Claude Opus 4.6", note: "가장 강력", provider: "anthropic" },
    { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", note: "균형", provider: "anthropic" },
    { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", note: "빠름 · 경량", provider: "anthropic" }
  ],
  openai: [
    { id: "gpt-5.4", label: "GPT-5.4", note: "최신 플래그십", provider: "openai" },
    { id: "gpt-5.4-mini", label: "GPT-5.4 mini", note: "균형", provider: "openai" },
    { id: "gpt-5.4-nano", label: "GPT-5.4 nano", note: "경량 · 빠름", provider: "openai" },
    { id: "gpt-4.1", label: "GPT-4.1", note: "이전 세대", provider: "openai" }
  ],
  google: [
    { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro", note: "최신 플래그십", provider: "google" },
    { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", note: "안정 · 장문맥", provider: "google" },
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", note: "고성능 · 저가", provider: "google" }
  ]
};

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google AI"
};

const LEVEL_STYLES: Record<1 | 2 | 3, string> = {
  1: "bg-green-100 text-green-700",
  2: "bg-amber-100 text-amber-700",
  3: "bg-rose-100 text-rose-700"
};

export function Dev2ProblemDetail({ problemId }: { problemId: string }) {
  const router = useRouter();
  const { withPrefix } = useRouteScope();
  const user = useAuthStore((s) => s.user);
  const addToast = useUiStore((s) => s.addToast);
  const [language, setLanguage] = useState<ProblemLanguage>("java");
  const [aiModel, setAiModel] = useState<ModelOption>({
    id: "aig-default",
    label: "AIG 기본 모델",
    note: "시스템 제공",
    provider: "default"
  });
  const [byokKeys, setByokKeys] = useState<Record<string, string>>({});
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: problem, isLoading, isError } = useQuery({
    queryKey: ["problem", problemId],
    queryFn: () => problemApi.getProblemDetail(problemId)
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(BYOK_STORAGE_KEY);
      setByokKeys(raw ? JSON.parse(raw) : {});
    } catch {
      setByokKeys({});
    }
  }, []);

  const needsKey =
    aiModel.provider !== "default" && !byokKeys[aiModel.provider];

  const { parsedEndpoints, beforeDescription, afterDescription } = useMemo(() => {
    if (!problem?.description) return { parsedEndpoints: [], beforeDescription: "", afterDescription: "" };

    const lines = problem.description.split("\n");
    const endpointLines: string[] = [];
    let firstIdx = -1;
    let lastIdx = -1;

    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^-\s+`((?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+[^`]+)`/);
      if (m) {
        if (firstIdx === -1) firstIdx = i;
        lastIdx = i;
        endpointLines.push(m[1].trim());
      }
    }

    if (firstIdx === -1) {
      return { parsedEndpoints: [], beforeDescription: problem.description, afterDescription: "" };
    }

    return {
      parsedEndpoints: endpointLines,
      beforeDescription: lines.slice(0, firstIdx).join("\n").trim(),
      afterDescription: lines.slice(lastIdx + 1).join("\n").trim()
    };
  }, [problem?.description]);

  const endpointsText = useMemo(() => parsedEndpoints.join("\n"), [parsedEndpoints]);

  const handleCopy = async () => {
    if (!endpointsText) return;
    try {
      await navigator.clipboard.writeText(endpointsText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  };

  const handleStart = async () => {
    if (!user) {
      addToast("로그인이 필요합니다.", "warning");
      router.push(withPrefix("/login"));
      return;
    }

    try {
      const session = isBackendProblemId(problemId)
        ? await sessionApi.startSession(problemId, user.id, language, aiModel.id, aiModel.provider)
        : await mockApi.createSession(problemId, user.id, language, aiModel.id, aiModel.provider);
      addToast("풀이 세션이 생성되었습니다.", "success");
      router.push(withPrefix(`/sessions/${session.id}/start`));
    } catch (error) {
      addToast(
        error instanceof Error ? error.message : "세션 생성에 실패했습니다.",
        "error"
      );
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-6 pt-28 pb-12">
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <div className="inline-flex items-center space-x-2 text-gray-500">
            <Sparkles size={18} className="animate-pulse" />
            <span>과제 정보를 불러오는 중…</span>
          </div>
        </div>
      </div>
    );
  }

  if (isError || !problem) {
    return (
      <div className="max-w-6xl mx-auto px-6 pt-28 pb-12">
        <div className="bg-white rounded-2xl border border-rose-100 p-10 text-center">
          <AlertTriangle size={32} className="mx-auto text-rose-500 mb-3" />
          <p className="text-gray-700 font-semibold mb-1">과제를 찾을 수 없습니다.</p>
          <p className="text-sm text-gray-500">잘못된 링크이거나 삭제된 과제일 수 있습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative bg-[#EEF2FF] min-h-screen overflow-hidden">
      {/* Background grid */}
      <div className="absolute top-0 left-0 right-0 h-[700px] pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-30" />
      </div>

      <div className="relative max-w-6xl mx-auto px-6 pt-28 pb-16">
        {/* Breadcrumb */}
        <Link
          href={withPrefix("/problems")}
          className="inline-flex items-center space-x-1.5 text-sm text-gray-500 hover:text-indigo-600 mb-6 transition-colors"
        >
          <ArrowLeft size={14} />
          <span>과제 목록</span>
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
          {/* ── Main Column ── */}
          <div className="space-y-6">
            {/* Hero Card */}
            <section
              className="relative bg-white rounded-2xl border border-gray-200/80 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9),0_1px_2px_rgba(17,24,39,0.04),0_12px_28px_-16px_rgba(79,70,229,0.18)] p-8 md:p-10 overflow-hidden animate-slide-up"
            >
              <div
                className="absolute inset-0 pointer-events-none opacity-70"
                style={{
                  backgroundImage:
                    "linear-gradient(135deg, rgba(238,242,255,0.9) 0%, rgba(250,245,255,0.6) 60%, rgba(255,255,255,0) 100%)"
                }}
              />
              <div className="relative flex items-start justify-between gap-4 mb-4">
                <h1 className="text-3xl md:text-4xl font-display font-bold text-gray-900 tracking-tight leading-[1.15]">
                  {problem.title}
                </h1>
                <span className={`shrink-0 text-xs font-bold px-3 py-1.5 rounded-full ${LEVEL_STYLES[problem.level]}`}>
                  Lv {problem.level}
                </span>
              </div>
              <p className="relative text-[15px] text-gray-600 leading-relaxed max-w-2xl">
                {problem.summary}
              </p>
            </section>

            {/* Problem Brief */}
            <section
              className="bg-white rounded-2xl border border-gray-200/80 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9),0_1px_2px_rgba(17,24,39,0.04),0_12px_28px_-16px_rgba(79,70,229,0.18)] p-8 animate-slide-up"
              style={{ animationDelay: "0.05s", animationFillMode: "both" }}
            >
              <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-gray-500 mb-2">
                Problem Brief
              </span>
              <h2 className="text-xl font-display font-bold text-gray-900 mb-4">
                Requirements
              </h2>
              {beforeDescription && (
                <div className="prose-mini text-[15px] text-gray-700 leading-relaxed mb-5">
                  <Markdown components={markdownComponents}>{beforeDescription}</Markdown>
                </div>
              )}
              {parsedEndpoints.length > 0 && (
                <div className="relative bg-gray-900 rounded-xl overflow-hidden mb-5">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="absolute top-3 right-3 p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
                    aria-label="복사"
                  >
                    {copied ? (
                      <CheckIcon size={14} strokeWidth={2.4} className="text-green-400" />
                    ) : (
                      <Copy size={14} strokeWidth={2} />
                    )}
                  </button>
                  <div className="flex">
                    <div className="shrink-0 py-4 pl-4 pr-3 text-xs font-mono text-gray-600 select-none">
                      {parsedEndpoints.map((_, i) => (
                        <div key={i} className="leading-6">{i + 1}</div>
                      ))}
                    </div>
                    <pre className="flex-1 py-4 pr-4 text-sm text-gray-100 font-mono leading-6 overflow-x-auto">
                      {parsedEndpoints.map((line, i) => (
                        <div key={i}>{highlightEndpoint(line)}</div>
                      ))}
                    </pre>
                  </div>
                </div>
              )}
              {afterDescription && (
                <div className="prose-mini text-[15px] text-gray-700 leading-relaxed mb-5">
                  <Markdown components={markdownComponents}>{afterDescription}</Markdown>
                </div>
              )}

              <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                {problem.publicCases.map((test) => (
                  <div key={test.id} className="rounded-xl border border-gray-200 bg-gray-50/70 p-4">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <h3 className="text-sm font-bold text-gray-900">{test.name}</h3>
                      <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                        공개
                      </span>
                    </div>
                    <code className="block rounded-lg bg-white border border-gray-100 px-3 py-2 font-mono text-xs text-gray-700 whitespace-pre-wrap">
                      {test.detail}
                    </code>
                    <p className="mt-2 text-xs font-semibold text-green-700">{test.result}</p>
                  </div>
                ))}
              </div>

            </section>
          </div>

          {/* ── Side Column ── */}
          <aside className="lg:sticky lg:top-24 self-start">
            <section
              className="bg-white rounded-2xl border border-gray-200/80 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9),0_1px_2px_rgba(17,24,39,0.04),0_12px_28px_-16px_rgba(79,70,229,0.18)] p-6 space-y-5 animate-slide-up"
              style={{ animationDelay: "0.1s", animationFillMode: "both" }}
            >
              {/* Header */}
              <div className="flex items-center space-x-2.5 pb-4 border-b border-gray-100">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 text-gray-700">
                  <Info size={16} strokeWidth={2.2} />
                </span>
                <span className="font-display font-bold text-gray-900 text-[17px]">과제 정보</span>
              </div>

              {/* Meta rows */}
              <div className="divide-y divide-gray-100">
                <MetaRow label="카테고리" value={problem.category} />
                <MetaRow label="상태" value={problem.status} />
                <MetaRow
                  label="예상 시간"
                  value={
                    <span className="inline-flex items-center space-x-1">
                      <Clock size={12} strokeWidth={2.2} />
                      <span>{problem.estimate}</span>
                    </span>
                  }
                />
                <MetaRow label="통과율" value={`${problem.passRate}%`} />
              </div>

              {/* Language */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-gray-500 mb-2.5">
                  Language
                </label>
                <div className="flex flex-col gap-2">
                  {LANG_OPTIONS.map((opt) => {
                    const active = language === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setLanguage(opt.value)}
                        className={`flex items-center gap-2.5 p-3 rounded-xl border-2 text-left transition-all ${
                          active
                            ? "border-indigo-500 bg-indigo-50/40 shadow-sm"
                            : "border-gray-200 bg-white hover:border-indigo-200"
                        }`}
                      >
                        <LangIcon language={opt.value} size={22} />
                        <div className="min-w-0">
                          <div className="font-semibold text-gray-900 text-sm">{opt.label}</div>
                          <div className="text-[11px] text-gray-500 truncate">{opt.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* AI Model */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-gray-500 mb-2.5">
                  AI Model
                </label>
                <ModelSelect
                  aiModel={aiModel}
                  setAiModel={setAiModel}
                  byokKeys={byokKeys}
                  open={modelMenuOpen}
                  setOpen={setModelMenuOpen}
                />
                {needsKey && (
                  <div className="mt-2.5 flex items-center space-x-2 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg px-3.5 py-2.5">
                    <AlertTriangle size={14} className="shrink-0" />
                    <span className="font-medium">
                      API 키가 필요합니다.{" "}
                      <Link href={withPrefix("/mypage")} className="underline hover:text-amber-900">
                        마이페이지에서 등록
                      </Link>
                    </span>
                  </div>
                )}
              </div>

              {/* Start button */}
              <button
                type="button"
                onClick={handleStart}
                className="group w-full flex items-center justify-center space-x-2 text-white font-semibold py-4 rounded-2xl hover:-translate-y-0.5 transition-all"
                style={{
                  backgroundImage: "linear-gradient(90deg, #4F46E5, #7C3AED)",
                  boxShadow: "0 16px 32px -12px rgba(99,102,241,0.5)"
                }}
              >
                <Rocket size={16} strokeWidth={2.4} />
                <span className="text-[15px]">풀이 시작</span>
                <ArrowRight size={16} strokeWidth={2.4} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

/* ─── Subcomponents ─── */

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm py-3">
      <span className="text-gray-500">{label}</span>
      <span className="font-semibold text-gray-900">{value}</span>
    </div>
  );
}

function ModelSelect({
  aiModel,
  setAiModel,
  byokKeys,
  open,
  setOpen
}: {
  aiModel: ModelOption;
  setAiModel: (m: ModelOption) => void;
  byokKeys: Record<string, string>;
  open: boolean;
  setOpen: (v: boolean) => void;
}) {
  // Close on Escape / outside click
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, setOpen]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border-2 bg-white text-left transition-colors ${
          open
            ? "border-indigo-500 ring-2 ring-indigo-100"
            : "border-gray-200 hover:border-indigo-300"
        }`}
      >
        <div>
          <div className="font-semibold text-gray-900 text-[15px]">{aiModel.label}</div>
          <div className="text-xs text-gray-500 mt-0.5">
            {aiModel.provider === "default"
              ? "시스템 제공"
              : `${PROVIDER_LABELS[aiModel.provider]} · ${aiModel.note}`}
          </div>
        </div>
        <ChevronDown
          size={18}
          strokeWidth={2}
          className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <>
          {/* Backdrop for click-outside */}
          <div
            className="fixed inset-0 z-30"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute left-0 right-0 mt-2 bg-white rounded-xl border border-gray-200 shadow-xl z-40 overflow-hidden max-h-[320px] overflow-y-auto">
            {/* Default group */}
            <div className="py-2">
              <div className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400">
                AIG
              </div>
              {MODEL_OPTIONS.default.map((m) => (
                <ModelRow
                  key={m.id}
                  model={m}
                  active={aiModel.id === m.id}
                  disabled={false}
                  onClick={() => {
                    setAiModel(m);
                    setOpen(false);
                  }}
                />
              ))}
            </div>
            {Object.entries(MODEL_OPTIONS)
              .filter(([p]) => p !== "default")
              .map(([provider, models]) => {
                const hasKey = Boolean(byokKeys[provider]);
                return (
                  <div key={provider} className="py-2 border-t border-gray-100">
                    <div className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400 flex items-center justify-between">
                      <span>{PROVIDER_LABELS[provider]}</span>
                      {!hasKey && (
                        <span className="inline-flex items-center space-x-1 text-amber-600 normal-case tracking-normal font-semibold text-[10px]">
                          <AlertTriangle size={10} strokeWidth={2.4} />
                          <span>Key 미등록</span>
                        </span>
                      )}
                    </div>
                    {models.map((m) => (
                      <ModelRow
                        key={m.id}
                        model={m}
                        active={aiModel.id === m.id}
                        disabled={!hasKey}
                        onClick={() => {
                          if (!hasKey) return;
                          setAiModel(m);
                          setOpen(false);
                        }}
                      />
                    ))}
                  </div>
                );
              })}
          </div>
        </>
      )}
    </div>
  );
}

function ModelRow({
  model,
  active,
  disabled,
  onClick
}: {
  model: ModelOption;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors ${
        disabled
          ? "opacity-50 cursor-not-allowed"
          : active
            ? "bg-indigo-50"
            : "hover:bg-gray-50"
      }`}
    >
      <div>
        <div
          className={`text-sm font-semibold ${
            active ? "text-indigo-700" : "text-gray-900"
          }`}
        >
          {model.label}
        </div>
        <div className="text-xs text-gray-500 mt-0.5">{model.note}</div>
      </div>
      {active && <Check size={14} strokeWidth={3} className="text-indigo-600" />}
    </button>
  );
}

/* Fenced code block used inside Markdown (JSON response examples etc.) */
function FencedCode({ language, code }: { language?: string; code: string }) {
  const [isCopied, setIsCopied] = useState(false);
  const lines = code.trimEnd().split("\n");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code.trimEnd());
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 1500);
    } catch { /* noop */ }
  };

  return (
    <div className="relative bg-gray-900 rounded-xl overflow-hidden my-4">
      {language && (
        <div className="px-4 pt-3 pb-0 text-[10px] font-mono font-bold uppercase tracking-widest text-gray-500 select-none">
          {language}
        </div>
      )}
      <button
        type="button"
        onClick={handleCopy}
        className="absolute top-3 right-3 p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
        aria-label="복사"
      >
        {isCopied ? (
          <CheckIcon size={14} strokeWidth={2.4} className="text-green-400" />
        ) : (
          <Copy size={14} strokeWidth={2} />
        )}
      </button>
      <div className="flex">
        <div className="shrink-0 py-4 pl-4 pr-3 text-xs font-mono text-gray-600 select-none">
          {lines.map((_, i) => (
            <div key={i} className="leading-6">{i + 1}</div>
          ))}
        </div>
        <pre className="flex-1 py-4 pr-4 text-sm text-gray-100 font-mono leading-6 overflow-x-auto">
          {lines.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </pre>
      </div>
    </div>
  );
}

export const markdownComponents = {
  pre({ children }: { children?: React.ReactNode }) {
    const child = Array.isArray(children) ? children[0] : children;
    if (!child || typeof child !== "object") return <pre>{children}</pre>;
    const el = child as React.ReactElement<{ className?: string; children?: React.ReactNode }>;
    const className = el.props.className ?? "";
    const match = /language-(\w+)/.exec(className);
    const code = String(el.props.children ?? "").replace(/\n$/, "");
    return <FencedCode language={match?.[1]} code={code} />;
  }
};

/* Endpoint highlighting — color the HTTP verb */
function highlightEndpoint(line: string) {
  const match = line.match(/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(.*)$/);
  if (!match) return <span>{line}</span>;
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
      <span className="text-gray-100"> {rest}</span>
    </>
  );
}

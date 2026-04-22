"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Markdown from "react-markdown";
import {
  ArrowLeft,
  Sparkles,
  Clock,
  TrendingUp,
  Code2,
  Rocket,
  AlertTriangle,
  Check
} from "lucide-react";

import { LangIcon } from "@/components/common/LangIcon";
import { useRouteScope } from "@/components/routing/RouteScopeProvider";
import { mockApi } from "@/lib/api/mockApi";
import type { ProblemDetail as ProblemDetailType } from "@/lib/types/problem";
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

const LEVEL_COLORS = {
  1: "bg-green-50 text-green-700 border-green-200",
  2: "bg-amber-50 text-amber-700 border-amber-200",
  3: "bg-rose-50 text-rose-700 border-rose-200"
} as const;

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

  const { data: problem, isLoading, isError } = useQuery({
    queryKey: ["problem", problemId],
    queryFn: () => mockApi.getProblemDetail(problemId)
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(BYOK_STORAGE_KEY);
      setByokKeys(raw ? JSON.parse(raw) : {});
    } catch {
      setByokKeys({});
    }
  }, []);

  const handleStart = async () => {
    if (!user) {
      addToast("로그인이 필요합니다.", "warning");
      router.push(withPrefix("/login"));
      return;
    }

    try {
      const session = await mockApi.createSession(
        problemId,
        user.id,
        language,
        aiModel.id,
        aiModel.provider
      );
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
      <div className="max-w-7xl mx-auto px-6 py-12">
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
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="bg-white rounded-2xl border border-rose-100 p-10 text-center">
          <AlertTriangle size={32} className="mx-auto text-rose-500 mb-3" />
          <p className="text-gray-700 font-semibold mb-1">과제를 찾을 수 없습니다.</p>
          <p className="text-sm text-gray-500">잘못된 링크이거나 삭제된 과제일 수 있습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-b from-indigo-50/30 via-white to-white min-h-screen">
      <div className="max-w-7xl mx-auto px-6 py-10">
        <Link
          href={withPrefix("/problems")}
          className="inline-flex items-center space-x-1.5 text-sm text-gray-500 hover:text-indigo-600 mb-6 transition-colors"
        >
          <ArrowLeft size={14} />
          <span>과제 목록</span>
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          {/* ── Main Column ── */}
          <div className="space-y-6">
            {/* Header Card */}
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-8 bg-gradient-to-br from-indigo-50/50 to-purple-50/30 border-b border-gray-100">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <h1 className="text-2xl md:text-3xl font-display font-bold text-gray-900 tracking-tight">
                    {problem.title}
                  </h1>
                  <span
                    className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border ${LEVEL_COLORS[problem.level]}`}
                  >
                    Lv {problem.level}
                  </span>
                </div>
                <p className="text-gray-600 leading-relaxed">{problem.summary}</p>
              </div>

              <div className="p-8 space-y-6">
                {/* Language pick */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
                    풀이 언어
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {LANG_OPTIONS.map((opt) => {
                      const active = language === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setLanguage(opt.value)}
                          className={`flex items-center space-x-3 p-4 rounded-xl border-2 text-left transition-all ${
                            active
                              ? "border-indigo-500 bg-indigo-50/50 shadow-sm"
                              : "border-gray-200 hover:border-indigo-200"
                          }`}
                        >
                          <LangIcon language={opt.value} size={24} />
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <span className="font-semibold text-gray-900">{opt.label}</span>
                              {active && (
                                <Check size={14} className="text-indigo-600" strokeWidth={3} />
                              )}
                            </div>
                            <span className="text-xs text-gray-500">{opt.desc}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Model pick */}
                <div>
                  <label
                    htmlFor="dev2-model-select"
                    className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3"
                  >
                    AI 모델
                  </label>
                  <select
                    id="dev2-model-select"
                    value={aiModel.id}
                    onChange={(e) => {
                      const all = Object.values(MODEL_OPTIONS).flat();
                      const found = all.find((m) => m.id === e.target.value);
                      if (found) setAiModel(found);
                    }}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                  >
                    {MODEL_OPTIONS.default.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label} — {opt.note}
                      </option>
                    ))}
                    {Object.entries(MODEL_OPTIONS)
                      .filter(([p]) => p !== "default")
                      .map(([provider, models]) => (
                        <optgroup
                          key={provider}
                          label={`${PROVIDER_LABELS[provider]}${!byokKeys[provider] ? " (키 미등록)" : ""}`}
                        >
                          {models.map((opt) => (
                            <option
                              key={opt.id}
                              value={opt.id}
                              disabled={!byokKeys[provider]}
                            >
                              {opt.label} — {opt.note}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                  </select>
                  {!byokKeys[aiModel.provider] && aiModel.provider !== "default" && (
                    <div className="mt-2 flex items-center space-x-1.5 text-xs text-amber-600">
                      <AlertTriangle size={12} />
                      <span>선택한 모델의 API 키가 등록되지 않았습니다.</span>
                    </div>
                  )}
                </div>

                {/* Start */}
                <button
                  type="button"
                  onClick={handleStart}
                  className="w-full flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3.5 rounded-xl shadow-sm transition-colors"
                >
                  <Rocket size={16} strokeWidth={2.4} />
                  <span>풀이 시작</span>
                </button>
              </div>
            </section>

            {/* Description Card */}
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
              <div className="mb-5">
                <span className="inline-block text-xs font-semibold uppercase tracking-wider text-indigo-600 mb-2">
                  과제 개요
                </span>
                <h2 className="text-xl font-display font-bold text-gray-900">문제 설명</h2>
              </div>

              <div className="prose-mini mb-6 text-gray-700 leading-relaxed">
                <Markdown>{problem.description}</Markdown>
              </div>

              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">핵심 요구사항</h3>
                <ul className="space-y-2">
                  {problem.requirements.map((req) => (
                    <li key={req} className="flex items-start space-x-2 text-sm text-gray-700">
                      <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2" />
                      <span className="leading-relaxed">{req}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">요구 엔드포인트</h3>
                <div className="bg-gray-900 rounded-xl p-4 overflow-x-auto">
                  <pre className="text-sm text-gray-100 font-mono leading-relaxed whitespace-pre">
                    {problem.endpoints.join("\n")}
                  </pre>
                </div>
              </div>
            </section>
          </div>

          {/* ── Side Column ── */}
          <aside className="lg:sticky lg:top-24 self-start">
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center space-x-2">
                <TrendingUp size={14} className="text-indigo-600" />
                <span>과제 정보</span>
              </h3>

              <div className="space-y-3">
                <MetaRow label="카테고리" value={problem.category} />
                <MetaRow
                  label="풀이 언어"
                  value={
                    <LangIcon language={language} size={14} showLabel className="inline-flex" />
                  }
                />
                <MetaRow label="AI 모델" value={aiModel.label} />
                <MetaRow
                  label="제한시간"
                  value={
                    <span className="inline-flex items-center space-x-1">
                      <Clock size={12} />
                      <span>{problem.estimate}</span>
                    </span>
                  }
                />
                <MetaRow label="현재 통과율" value={`${problem.passRate}%`} />
              </div>

              <div className="pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={handleStart}
                  className="w-full flex items-center justify-center space-x-2 bg-gray-900 hover:bg-gray-800 text-white font-semibold py-3 rounded-xl transition-colors"
                >
                  <Code2 size={16} strokeWidth={2} />
                  <span>IDE로 바로 시작</span>
                </button>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-semibold text-gray-900">{value}</span>
    </div>
  );
}

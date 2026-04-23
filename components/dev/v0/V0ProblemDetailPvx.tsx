"use client";

import Link from "next/link";
import Markdown from "react-markdown";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { LangIcon } from "@/components/common/LangIcon";
import { useRouteScope } from "@/components/routing/RouteScopeProvider";
import { mockApi } from "@/lib/api/mockApi";
import type { ProblemDetail } from "@/lib/types/problem";
import type { ProblemLanguage } from "@/lib/types/session";
import { useAuthStore } from "@/store/authStore";
import { useUiStore } from "@/store/uiStore";

// ── Constants ─────────────────────────────────────────────────────────────

const LANG_OPTIONS: { value: ProblemLanguage; label: string; desc: string }[] = [
  { value: "java",   label: "Java",   desc: "Spring Boot · JPA" },
  { value: "python", label: "Python", desc: "FastAPI · Pydantic" },
];

const BYOK_STORAGE_KEY = "aig-byok-keys-v1";

type ModelOption = { id: string; label: string; note: string; provider: string };

const MODEL_OPTIONS: Record<string, ModelOption[]> = {
  default: [
    { id: "aig-default", label: "AIG 기본 모델", note: "시스템 제공", provider: "default" },
  ],
  anthropic: [
    { id: "claude-opus-4-6",   label: "Claude Opus 4.6",   note: "가장 강력",   provider: "anthropic" },
    { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", note: "균형",        provider: "anthropic" },
    { id: "claude-haiku-4-5",  label: "Claude Haiku 4.5",  note: "빠름 · 경량", provider: "anthropic" },
  ],
  openai: [
    { id: "gpt-5.4",      label: "GPT-5.4",      note: "최신 플래그십", provider: "openai" },
    { id: "gpt-5.4-mini", label: "GPT-5.4 mini", note: "균형",          provider: "openai" },
    { id: "gpt-5.4-nano", label: "GPT-5.4 nano", note: "경량 · 빠름",   provider: "openai" },
    { id: "gpt-4.1",      label: "GPT-4.1",      note: "이전 세대",     provider: "openai" },
  ],
  google: [
    { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro",   note: "최신 플래그십", provider: "google" },
    { id: "gemini-2.5-pro",         label: "Gemini 2.5 Pro",   note: "안정 · 장문맥", provider: "google" },
    { id: "gemini-2.5-flash",       label: "Gemini 2.5 Flash", note: "고성능 · 저가", provider: "google" },
  ],
};

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google AI",
};

const METHOD_CLASS: Record<string, string> = {
  GET:    "pvxd-method--get",
  POST:   "pvxd-method--post",
  PUT:    "pvxd-method--put",
  PATCH:  "pvxd-method--patch",
  DELETE: "pvxd-method--delete",
};

const LEVEL_LABEL: Record<number, string> = { 1: "입문", 2: "중급", 3: "고급" };

// ── Helpers ───────────────────────────────────────────────────────────────

function parseEndpoint(ep: string): { method: string; path: string } {
  const [method, ...rest] = ep.split(" ");
  return { method: method.toUpperCase(), path: rest.join(" ") };
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

// ── Sub-components ────────────────────────────────────────────────────────

function Aurora() {
  return (
    <div className="pvxd-aurora" aria-hidden>
      <div className="pvxd-aurora__blob pvxd-aurora__blob--a" />
      <div className="pvxd-aurora__blob pvxd-aurora__blob--b" />
      <div className="pvxd-aurora__blob pvxd-aurora__blob--c" />
    </div>
  );
}

function Skeleton() {
  return (
    <div className="pvxd-shell">
      <Aurora />
      <div className="pvxd-container">
        <div className="pvxd-skel pvxd-skel--back" />
        <div className="pvxd-skel pvxd-skel--h1" />
        <div className="pvxd-skel pvxd-skel--meta" />
        <div className="pvxd-body">
          <div className="pvxd-content">
            <div className="pvxd-card">
              <div className="pvxd-skel pvxd-skel--label" />
              <div className="pvxd-skel pvxd-skel--title" />
              {[90, 75, 60].map((w, i) => (
                <div key={i} className="pvxd-skel pvxd-skel--line" style={{ width: `${w}%` }} />
              ))}
            </div>
          </div>
          <div className="pvxd-sidebar">
            <div className="pvxd-sidebar__inner">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="pvxd-skel pvxd-skel--line" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HttpMethod({ method }: { method: string }) {
  return (
    <span className={`pvxd-method ${METHOD_CLASS[method] ?? ""}`}>{method}</span>
  );
}

function LangPicker({
  value,
  onChange,
}: {
  value: ProblemLanguage;
  onChange: (v: ProblemLanguage) => void;
}) {
  return (
    <div className="pvxd-lang-pick">
      <span className="pvxd-pick__label">풀이 언어</span>
      <div className="pvxd-lang-pick__options">
        {LANG_OPTIONS.map(({ value: v, label, desc }) => (
          <button
            key={v}
            type="button"
            className={"pvxd-lang-card" + (value === v ? " pvxd-lang-card--on" : "")}
            onClick={() => onChange(v)}
          >
            <LangIcon language={v} size={22} className="pvxd-lang-card__icon" />
            <span className="pvxd-lang-card__name">{label}</span>
            <span className="pvxd-lang-card__desc">{desc}</span>
            {value === v && <span className="pvxd-lang-card__check" aria-hidden>✓</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

function ModelPicker({
  value,
  onChange,
  byokKeys,
}: {
  value: ModelOption;
  onChange: (m: ModelOption) => void;
  byokKeys: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="pvxd-model-pick" ref={ref}>
      <span className="pvxd-pick__label">AI 모델</span>
      <button
        type="button"
        className={"pvxd-model-trigger" + (open ? " pvxd-model-trigger--open" : "")}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="pvxd-model-trigger__inner">
          <span className="pvxd-model-trigger__label">{value.label}</span>
          <span className="pvxd-model-trigger__note">{value.note}</span>
        </span>
        <svg
          className="pvxd-model-trigger__chevron"
          width="14" height="14" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2.5"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="pvxd-model-drop" role="listbox">
          {MODEL_OPTIONS.default.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="option"
              aria-selected={value.id === opt.id}
              className={"pvxd-model-opt" + (value.id === opt.id ? " pvxd-model-opt--on" : "")}
              onClick={() => { onChange(opt); setOpen(false); }}
            >
              <span className="pvxd-model-opt__label">{opt.label}</span>
              <span className="pvxd-model-opt__note">{opt.note}</span>
            </button>
          ))}
          {Object.entries(MODEL_OPTIONS)
            .filter(([p]) => p !== "default")
            .map(([provider, models]) => {
              const hasKey = !!byokKeys[provider];
              return (
                <div key={provider} className={"pvxd-model-group" + (!hasKey ? " pvxd-model-group--locked" : "")}>
                  <span className="pvxd-model-group__label">
                    {PROVIDER_LABELS[provider]}
                    {!hasKey && <span className="pvxd-model-group__lock">키 미등록</span>}
                  </span>
                  {models.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      role="option"
                      aria-selected={value.id === opt.id}
                      disabled={!hasKey}
                      className={"pvxd-model-opt" + (value.id === opt.id ? " pvxd-model-opt--on" : "")}
                      onClick={() => { onChange(opt); setOpen(false); }}
                    >
                      <span className="pvxd-model-opt__label">{opt.label}</span>
                      <span className="pvxd-model-opt__note">{opt.note}</span>
                    </button>
                  ))}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

function MetaSidebar({
  problem,
  language,
  aiModel,
  byokKeys,
  onLanguageChange,
  onAiModelChange,
  onStart,
}: {
  problem: ProblemDetail;
  language: ProblemLanguage;
  aiModel: ModelOption;
  byokKeys: Record<string, string>;
  onLanguageChange: (v: ProblemLanguage) => void;
  onAiModelChange: (m: ModelOption) => void;
  onStart: () => void;
}) {
  return (
    <aside className="pvxd-sidebar">
      <div className="pvxd-sidebar__inner">
        <LangPicker value={language} onChange={onLanguageChange} />
        <ModelPicker value={aiModel} onChange={onAiModelChange} byokKeys={byokKeys} />

        <div className="pvxd-meta">
          <div className="pvxd-meta__item">
            <span className="pvxd-meta__k">레벨</span>
            <span className={`pvxd-lv pvxd-lv--${problem.level}`}>
              Lv {problem.level} · {LEVEL_LABEL[problem.level]}
            </span>
          </div>
          <div className="pvxd-meta__item">
            <span className="pvxd-meta__k">유형</span>
            <span className="pvxd-meta__v">{problem.category}</span>
          </div>
          <div className="pvxd-meta__item">
            <span className="pvxd-meta__k">제한시간</span>
            <span className="pvxd-meta__v">{problem.estimate}</span>
          </div>
          <div className="pvxd-meta__item">
            <span className="pvxd-meta__k">통과율</span>
            <span className="pvxd-meta__v">{problem.passRate}%</span>
          </div>
        </div>

        <div className="pvxd-passbar" aria-label={`통과율 ${problem.passRate}%`}>
          <div className="pvxd-passbar__fill" style={{ width: `${problem.passRate}%` }} />
        </div>

        <button type="button" className="pvxd-start" onClick={onStart}>
          <span>풀이 시작</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </aside>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────

export function ProblemDetailPvx({ problemId }: { problemId: string }) {
  const router = useRouter();
  const { withPrefix } = useRouteScope();
  const user = useAuthStore((state) => state.user);
  const addToast = useUiStore((state) => state.addToast);

  const [language, setLanguage] = useState<ProblemLanguage>("java");
  const [aiModel, setAiModel] = useState<ModelOption>({
    id: "aig-default",
    label: "AIG 기본 모델",
    note: "시스템 제공",
    provider: "default",
  });
  const [byokKeys, setByokKeys] = useState<Record<string, string>>({});

  const { data: problem, isLoading, isError } = useQuery({
    queryKey: ["problem", problemId],
    queryFn: () => mockApi.getProblemDetail(problemId),
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(BYOK_STORAGE_KEY);
      setByokKeys(raw ? JSON.parse(raw) : {});
    } catch { setByokKeys({}); }
  }, []);

  const handleStart = async () => {
    if (!user) {
      addToast("로그인이 필요합니다.", "warning");
      router.push(withPrefix("/login"));
      return;
    }
    try {
      const session = await mockApi.createSession(
        problemId, user.id, language, aiModel.id, aiModel.provider
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

  if (isLoading) return <Skeleton />;
  if (isError || !problem) {
    return (
      <div className="pvxd-shell">
        <Aurora />
        <div className="pvxd-container pvxd-container--center">
          <p className="pvxd-err">과제 정보를 찾을 수 없습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pvxd-shell">
      <Aurora />
      <div className="pvxd-container">

        {/* Back */}
        <Link href={withPrefix("/problems")} className="pvxd-back">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          과제 목록
        </Link>

        {/* Hero */}
        <header className="pvxd-hero">
          <div className="pvxd-hero__eyebrow">
            <span className="pvxd-hero__eyebrow-dot" />
            PROBLEM #{problem.order} · {problem.category}
          </div>
          <h1 className="pvxd-hero__title">{problem.title}</h1>
          <div className="pvxd-hero__chips">
            <span className={`pvxd-lv pvxd-lv--${problem.level}`}>
              Lv {problem.level} · {LEVEL_LABEL[problem.level]}
            </span>
            <span className="pvxd-chip">{problem.estimate}</span>
            <span className="pvxd-chip">통과율 {problem.passRate}%</span>
          </div>
          <p className="pvxd-hero__summary">{problem.summary}</p>
        </header>

        {/* Body */}
        <div className="pvxd-body">

          {/* Left: Content */}
          <div className="pvxd-content">

            {/* Description */}
            <section className="pvxd-card pvxd-card--description" style={{ ["--pvxd-i" as string]: 0 }}>
              <div className="pvxd-card__sheen" aria-hidden />
              <p className="pvxd-section-label">과제 개요</p>
              <h2 className="pvxd-section-title">문제 설명</h2>
              <div className="pvxd-markdown">
                <Markdown>{problem.description}</Markdown>
              </div>
              {problem.requirements.length > 0 && (
                <ul className="pvxd-reqs">
                  {problem.requirements.map((req) => (
                    <li key={req} className="pvxd-reqs__item">
                      <span className="pvxd-reqs__dot" aria-hidden />
                      {req}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Endpoints */}
            {problem.endpoints.length > 0 && (
              <section className="pvxd-card" style={{ ["--pvxd-i" as string]: 1 }}>
                <div className="pvxd-card__sheen" aria-hidden />
                <p className="pvxd-section-label">API 설계</p>
                <h2 className="pvxd-section-title">요구 엔드포인트</h2>
                <div className="pvxd-endpoints">
                  {problem.endpoints.map((ep) => {
                    const { method, path } = parseEndpoint(ep);
                    return (
                      <div key={ep} className="pvxd-ep">
                        <HttpMethod method={method} />
                        <code className="pvxd-ep__path">{path}</code>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Test Cases */}
            {problem.publicCases.length > 0 && (
              <section className="pvxd-card" style={{ ["--pvxd-i" as string]: 2 }}>
                <div className="pvxd-card__sheen" aria-hidden />
                <p className="pvxd-section-label">검증</p>
                <h2 className="pvxd-section-title">공개 테스트 케이스</h2>
                <div className="pvxd-cases">
                  {problem.publicCases.map((tc, i) => {
                    const isOk = tc.result.startsWith("2");
                    const isErr = tc.result.startsWith("4") || tc.result.startsWith("5");
                    return (
                      <div key={tc.id} className="pvxd-case" style={{ ["--pvxd-i" as string]: i }}>
                        <div className="pvxd-case__head">
                          <span className="pvxd-case__num">TC-{pad(i + 1)}</span>
                          <span className="pvxd-case__name">{tc.name.replace(/TC-\d+\s*·\s*/, "")}</span>
                        </div>
                        <div className="pvxd-case__body">
                          <code className="pvxd-case__detail">{tc.detail}</code>
                          <span className={
                            "pvxd-case__result" +
                            (isOk ? " pvxd-case__result--ok" : isErr ? " pvxd-case__result--err" : "")
                          }>
                            {tc.result}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Criteria */}
            {problem.criteria.length > 0 && (
              <section className="pvxd-card" style={{ ["--pvxd-i" as string]: 3 }}>
                <div className="pvxd-card__sheen" aria-hidden />
                <p className="pvxd-section-label">평가</p>
                <h2 className="pvxd-section-title">채점 기준</h2>
                <div className="pvxd-criteria">
                  {problem.criteria.map((c, i) => (
                    <div key={c} className="pvxd-criterion" style={{ ["--pvxd-i" as string]: i }}>
                      <span className="pvxd-criterion__num">{pad(i + 1)}</span>
                      <span className="pvxd-criterion__text">{c}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* AI Guide */}
            {problem.aiGuide && (
              <section className="pvxd-card pvxd-card--guide" style={{ ["--pvxd-i" as string]: 4 }}>
                <div className="pvxd-card__sheen" aria-hidden />
                <div className="pvxd-guide__head">
                  <svg className="pvxd-guide__icon" width="18" height="18" viewBox="0 0 512 512" fill="none">
                    <g transform="rotate(-7 256 256)">
                      <path d="M164 344L248 176L352 334H164Z" stroke="currentColor" strokeWidth="18" strokeLinejoin="round" />
                      <circle cx="248" cy="176" r="28" stroke="currentColor" strokeWidth="14" />
                      <circle cx="164" cy="344" r="28" stroke="currentColor" strokeWidth="14" />
                      <circle cx="352" cy="334" r="28" stroke="currentColor" strokeWidth="14" />
                    </g>
                  </svg>
                  <p className="pvxd-section-label">AI 활용 가이드</p>
                </div>
                <h2 className="pvxd-section-title">AI와 함께 풀기</h2>
                <p className="pvxd-guide__text">{problem.aiGuide}</p>
              </section>
            )}
          </div>

          {/* Right: Sticky sidebar */}
          <MetaSidebar
            problem={problem}
            language={language}
            aiModel={aiModel}
            byokKeys={byokKeys}
            onLanguageChange={setLanguage}
            onAiModelChange={setAiModel}
            onStart={handleStart}
          />
        </div>
      </div>
    </div>
  );
}

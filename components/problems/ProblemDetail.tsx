"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Markdown from "react-markdown";

import { Badge } from "@/components/common/Badge";
import { Card } from "@/components/common/Card";
import { LangIcon } from "@/components/common/LangIcon";
import { useRouteScope } from "@/components/routing/RouteScopeProvider";
import { mockApi } from "@/lib/api/mockApi";
import type { ProblemDetail as ProblemDetailType } from "@/lib/types/problem";
import type { ProblemLanguage } from "@/lib/types/session";
import { useAuthStore } from "@/store/authStore";
import { useUiStore } from "@/store/uiStore";

const levelTone = {
  1: "level1",
  2: "level2",
  3: "level3"
} as const;

const LANG_OPTIONS: { value: ProblemLanguage; label: string; desc: string }[] = [
  { value: "java",   label: "Java",   desc: "Spring Boot · JPA" },
  { value: "python", label: "Python", desc: "FastAPI · Pydantic" }
];

const BYOK_STORAGE_KEY = "aig-byok-keys-v1";

type ModelOption = { id: string; label: string; note: string; provider: string };

const MODEL_OPTIONS: Record<string, ModelOption[]> = {
  default: [
    { id: "aig-default", label: "AIG 기본 모델", note: "시스템 제공", provider: "default" }
  ],
  anthropic: [
    { id: "claude-opus-4-6",   label: "Claude Opus 4.6",   note: "가장 강력",  provider: "anthropic" },
    { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", note: "균형",       provider: "anthropic" },
    { id: "claude-haiku-4-5",  label: "Claude Haiku 4.5",  note: "빠름 · 경량", provider: "anthropic" }
  ],
  openai: [
    { id: "gpt-5.4",      label: "GPT-5.4",      note: "최신 플래그십", provider: "openai" },
    { id: "gpt-5.4-mini", label: "GPT-5.4 mini", note: "균형",          provider: "openai" },
    { id: "gpt-5.4-nano", label: "GPT-5.4 nano", note: "경량 · 빠름",   provider: "openai" },
    { id: "gpt-4.1",      label: "GPT-4.1",      note: "이전 세대",     provider: "openai" }
  ],
  google: [
    { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro",   note: "최신 플래그십",  provider: "google" },
    { id: "gemini-2.5-pro",         label: "Gemini 2.5 Pro",   note: "안정 · 장문맥",  provider: "google" },
    { id: "gemini-2.5-flash",       label: "Gemini 2.5 Flash", note: "고성능 · 저가",  provider: "google" }
  ]
};

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google AI"
};

export function ProblemDetail({ problemId }: { problemId: string }) {
  const router = useRouter();
  const { withPrefix } = useRouteScope();
  const user = useAuthStore((state) => state.user);
  const addToast = useUiStore((state) => state.addToast);
  const [language, setLanguage] = useState<ProblemLanguage>("java");
  const [aiModel, setAiModel] = useState<ModelOption>({ id: "aig-default", label: "AIG 기본 모델", note: "시스템 제공", provider: "default" });
  const [byokKeys, setByokKeys] = useState<Record<string, string>>({});
  const { data: problem, isLoading, isError } = useQuery({
    queryKey: ["problem", problemId],
    queryFn: () => mockApi.getProblemDetail(problemId)
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
      const session = await mockApi.createSession(problemId, user.id, language, aiModel.id, aiModel.provider);
      addToast("풀이 세션이 생성되었습니다.", "success");
      router.push(withPrefix(`/sessions/${session.id}/start`));
    } catch (error) {
      addToast(error instanceof Error ? error.message : "세션 생성에 실패했습니다.", "error");
    }
  };

  if (isLoading) {
    return (
      <div className="center-shell">
        <div className="loader-card">
          <span className="eyebrow">불러오는 중</span>
          <strong>과제 정보를 불러오고 있습니다.</strong>
        </div>
      </div>
    );
  }

  if (isError || !problem) {
    return (
      <div className="center-shell">
        <div className="loader-card">
          <span className="eyebrow">찾을 수 없음</span>
          <strong>과제 정보를 찾을 수 없습니다.</strong>
        </div>
      </div>
    );
  }

  return (
    <ProblemDetailContent
      problem={problem}
      language={language}
      onLanguageChange={setLanguage}
      aiModel={aiModel}
      onAiModelChange={setAiModel}
      byokKeys={byokKeys}
      onStart={handleStart}
    />
  );
}

function ProblemDetailContent({
  problem,
  language,
  onLanguageChange,
  aiModel,
  onAiModelChange,
  byokKeys,
  onStart
}: {
  problem: ProblemDetailType;
  language: ProblemLanguage;
  onLanguageChange: (l: ProblemLanguage) => void;
  aiModel: ModelOption;
  onAiModelChange: (m: ModelOption) => void;
  byokKeys: Record<string, string>;
  onStart: () => void;
}) {
  const { withPrefix } = useRouteScope();

  return (
    <div className="detail-layout">
      <div className="stack-24">
        <Card>
          <Link href={withPrefix("/problems")} className="back-link problem-back-link">
            ← 과제 목록
          </Link>
          <div className="inline-heading">
            <h1>{problem.title}</h1>
            <Badge tone={levelTone[problem.level]}>Lv {problem.level}</Badge>
          </div>
          <p className="muted-copy problem-summary">{problem.summary}</p>

          {/* 언어 선택 */}
          <div className="lang-pick">
            <span className="lang-pick__label">풀이 언어</span>
            <div className="lang-pick__options">
              {LANG_OPTIONS.map(({ value, label, desc }) => (
                <button
                  key={value}
                  type="button"
                  className={`lang-pick-card${language === value ? " lang-pick-card--active" : ""}`}
                  onClick={() => onLanguageChange(value)}
                >
                  <LangIcon language={value} size={20} className="lang-pick-card__icon" />
                  <span className="lang-pick-card__name">{label}</span>
                  <span className="lang-pick-card__desc">{desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 모델 선택 */}
          <div className="model-select-wrap">
            <label className="lang-pick__label" htmlFor="model-select">AI 모델</label>
            <select
              id="model-select"
              className="model-select"
              value={aiModel.id}
              onChange={(e) => {
                const all = Object.values(MODEL_OPTIONS).flat();
                const found = all.find((m) => m.id === e.target.value);
                if (found) onAiModelChange(found);
              }}
            >
              {MODEL_OPTIONS.default.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.label} — {opt.note}</option>
              ))}
              {Object.entries(MODEL_OPTIONS)
                .filter(([p]) => p !== "default")
                .map(([provider, models]) => (
                  <optgroup
                    key={provider}
                    label={`${PROVIDER_LABELS[provider]}${!byokKeys[provider] ? " (키 미등록)" : ""}`}
                  >
                    {models.map((opt) => (
                      <option key={opt.id} value={opt.id} disabled={!byokKeys[provider]}>
                        {opt.label} — {opt.note}
                      </option>
                    ))}
                  </optgroup>
                ))}
            </select>
            {!byokKeys[aiModel.provider] && aiModel.provider !== "default" && (
              <p className="model-select__warn">선택한 모델의 API 키가 등록되지 않았습니다.</p>
            )}
          </div>

          <button className="button button--primary problem-start-btn" onClick={onStart}>
            풀이 시작
          </button>
        </Card>

        <Card>
          <span className="eyebrow">과제 개요</span>
          <h2 className="problem-section-title">문제 설명</h2>
          <div className="markdown-block">
            <Markdown>{problem.description}</Markdown>
          </div>
          <ul className="bullet-list">
            {problem.requirements.map((requirement) => (
              <li key={requirement}>{requirement}</li>
            ))}
          </ul>
          <div className="mini-panel">
            <strong>요구 엔드포인트</strong>
            <pre>{problem.endpoints.join("\n")}</pre>
          </div>
        </Card>
      </div>

      <aside>
        <Card className="problem-meta-card side-note">
          <div className="problem-meta">
            <div className="problem-meta__item">
              <span className="problem-meta__label">카테고리</span>
              <strong className="problem-meta__value">{problem.category}</strong>
            </div>
            <div className="problem-meta__item">
              <span className="problem-meta__label">풀이 언어</span>
              <strong className="problem-meta__value">
                <LangIcon language={language} size={14} showLabel className="lang-meta-badge" />
              </strong>
            </div>
            <div className="problem-meta__item">
              <span className="problem-meta__label">AI 모델</span>
              <strong className="problem-meta__value">{aiModel.label}</strong>
            </div>
            <div className="problem-meta__item">
              <span className="problem-meta__label">제한시간</span>
              <strong className="problem-meta__value">{problem.estimate}</strong>
            </div>
            <div className="problem-meta__item">
              <span className="problem-meta__label">현재 통과율</span>
              <strong className="problem-meta__value">{problem.passRate}%</strong>
            </div>
          </div>
          <button className="button button--primary problem-meta-card__btn" onClick={onStart}>
            풀이 시작
          </button>
        </Card>
      </aside>
    </div>
  );
}

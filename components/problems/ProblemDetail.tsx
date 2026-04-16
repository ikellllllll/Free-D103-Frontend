"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Markdown from "react-markdown";

import { Badge } from "@/components/common/Badge";
import { Card } from "@/components/common/Card";
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

const LANG_OPTIONS: { value: ProblemLanguage; label: string; icon: string; desc: string }[] = [
  { value: "java", label: "Java", icon: "☕", desc: "Spring Boot · JPA" },
  { value: "python", label: "Python", icon: "🐍", desc: "FastAPI · Pydantic" }
];

export function ProblemDetail({ problemId }: { problemId: string }) {
  const router = useRouter();
  const { withPrefix } = useRouteScope();
  const user = useAuthStore((state) => state.user);
  const addToast = useUiStore((state) => state.addToast);
  const [language, setLanguage] = useState<ProblemLanguage>("java");
  const { data: problem, isLoading, isError } = useQuery({
    queryKey: ["problem", problemId],
    queryFn: () => mockApi.getProblemDetail(problemId)
  });

  const handleStart = async () => {
    if (!user) {
      addToast("로그인이 필요합니다.", "warning");
      router.push(withPrefix("/login"));
      return;
    }

    try {
      const session = await mockApi.createSession(problemId, user.id, language);
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
      onStart={handleStart}
    />
  );
}

function ProblemDetailContent({
  problem,
  language,
  onLanguageChange,
  onStart
}: {
  problem: ProblemDetailType;
  language: ProblemLanguage;
  onLanguageChange: (l: ProblemLanguage) => void;
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
              {LANG_OPTIONS.map(({ value, label, icon, desc }) => (
                <button
                  key={value}
                  type="button"
                  className={`lang-pick-card${language === value ? " lang-pick-card--active" : ""}`}
                  onClick={() => onLanguageChange(value)}
                >
                  <span className="lang-pick-card__icon">{icon}</span>
                  <span className="lang-pick-card__name">{label}</span>
                  <span className="lang-pick-card__desc">{desc}</span>
                </button>
              ))}
            </div>
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
                {language === "java" ? "☕ Java" : "🐍 Python"}
              </strong>
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

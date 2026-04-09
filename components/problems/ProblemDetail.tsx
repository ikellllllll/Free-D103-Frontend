"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Markdown from "react-markdown";

import { Badge } from "@/components/common/Badge";
import { Card } from "@/components/common/Card";
import { mockApi } from "@/lib/api/mockApi";
import type { ProblemDetail as ProblemDetailType } from "@/lib/types/problem";
import { useAuthStore } from "@/store/authStore";
import { useUiStore } from "@/store/uiStore";

const levelTone = {
  1: "level1",
  2: "level2",
  3: "level3"
} as const;

export function ProblemDetail({ problemId }: { problemId: string }) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const addToast = useUiStore((state) => state.addToast);
  const { data: problem, isLoading, isError } = useQuery({
    queryKey: ["problem", problemId],
    queryFn: () => mockApi.getProblemDetail(problemId)
  });

  const handleStart = async () => {
    if (!user) {
      addToast("로그인이 필요합니다.", "warning");
      router.push("/login");
      return;
    }

    try {
      const session = await mockApi.createSession(problemId, user.id);
      addToast("풀이 세션이 생성되었습니다.", "success");
      router.push(`/sessions/${session.id}/start`);
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

  return <ProblemDetailContent problem={problem} onStart={handleStart} />;
}

function ProblemDetailContent({
  problem,
  onStart
}: {
  problem: ProblemDetailType;
  onStart: () => void;
}) {
  return (
    <div className="detail-layout">
      <div className="stack-24">
        <Card>
          <div className="section-head">
            <div>
              <Link href="/problems" className="back-link">
                ← 과제 목록
              </Link>
              <div className="inline-heading">
                <h1>{problem.title}</h1>
                <Badge tone={levelTone[problem.level]}>Lv {problem.level}</Badge>
              </div>
              <p className="muted-copy">{problem.summary}</p>
            </div>

            <button className="button button--primary" onClick={onStart}>
              풀이 시작
            </button>
          </div>
        </Card>

        <div className="grid-2">
          <Card>
            <span className="eyebrow">과제 개요</span>
            <h2>문제 설명</h2>
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

          <Card>
            <span className="eyebrow">평가</span>
            <h2>공개 테스트와 평가 기준</h2>

            <div className="stack-16">
              {problem.publicCases.map((testCase) => (
                <div key={testCase.id} className="case-card">
                  <strong>{testCase.name}</strong>
                  <span>{testCase.detail}</span>
                  <span className="case-card__result">{testCase.result}</span>
                </div>
              ))}
            </div>

            <ul className="bullet-list bullet-list--compact">
              {problem.criteria.map((criterion) => (
                <li key={criterion}>{criterion}</li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <Card className="side-note">
        <span className="eyebrow">AI 활용 힌트</span>
        <h3>이 과제에서 AI를 쓰는 방법</h3>
        <p>{problem.aiGuide}</p>

        <div className="side-note__meta">
          <div>
            <span>카테고리</span>
            <strong>{problem.category}</strong>
          </div>
          <div>
            <span>예상 시간</span>
            <strong>{problem.estimate}</strong>
          </div>
          <div>
            <span>현재 통과율</span>
            <strong>{problem.passRate}%</strong>
          </div>
        </div>
      </Card>
    </div>
  );
}

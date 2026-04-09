"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { Card } from "@/components/common/Card";
import { mockApi } from "@/lib/api/mockApi";

export function SubmissionProgress({ submissionId }: { submissionId: string }) {
  const { data: submission, isLoading } = useQuery({
    queryKey: ["submission", submissionId],
    queryFn: () => mockApi.getSubmission(submissionId),
    refetchInterval: (query) => (query.state.data?.status === "COMPLETED" ? false : 1200)
  });
  const { data: report } = useQuery({
    queryKey: ["report", submissionId],
    queryFn: () => mockApi.getReport(submissionId),
    refetchInterval: (query) => (query.state.data?.status === "COMPLETED" ? false : 1200)
  });

  const steps = useMemo(() => {
    const completed = submission?.status === "COMPLETED";
    const reportCompleted = report?.status === "COMPLETED";

    return [
      {
        label: "코드 채점 중",
        description: "테스트 케이스를 실행하고 제출물을 검증하고 있습니다.",
        state: completed || reportCompleted ? "done" : "current"
      },
      {
        label: "코드 리뷰 분석 중",
        description: "설계 일관성, 예외 처리, 구현 완성도를 점검하고 있습니다.",
        state: reportCompleted ? "done" : completed ? "current" : "pending"
      },
      {
        label: "AI 활용 분석 중",
        description: "Trace를 바탕으로 프롬프트 명확성과 자기 주도성을 종합하고 있습니다.",
        state: reportCompleted ? "done" : completed ? "current" : "pending"
      }
    ];
  }, [report?.status, submission?.status]);

  if (isLoading || !submission) {
    return (
      <div className="center-shell">
        <div className="loader-card">
          <span className="eyebrow">제출 상태</span>
          <strong>제출 상태를 확인하고 있습니다.</strong>
        </div>
      </div>
    );
  }

  return (
    <div className="narrow-shell">
      <Card className="glow-card">
        <span className="eyebrow">제출 진행</span>
        <h1>제출물을 분석하고 있습니다</h1>
        <p className="muted-copy">
          제출 ID #{submission.id} 기준으로 테스트 채점, 코드 리뷰, AI 활용 분석 단계를 순차적으로 처리하고 있습니다.
        </p>

        <div className="step-list">
          {steps.map((step) => (
            <div key={step.label} className={`step-card step-card--${step.state}`}>
              <strong>{step.label}</strong>
              <p>{step.description}</p>
            </div>
          ))}
        </div>

        <div className="submit-summary">
          <div>
            <span>제출 상태</span>
            <strong>{submission.status === "COMPLETED" ? "분석 완료" : "처리 중"}</strong>
          </div>
          <div>
            <span>제출 시간</span>
            <strong>{new Date(submission.submittedAt).toLocaleTimeString("ko-KR")}</strong>
          </div>
          <div>
            <span>리포트 상태</span>
            <strong>{report?.status === "COMPLETED" ? "완료" : "생성 중"}</strong>
          </div>
        </div>

        <div className="hero-actions">
          <Link href="/problems" className="button">
            과제 목록
          </Link>
          <Link href={`/submissions/${submissionId}/report`} className="button button--primary">
            리포트 보기
          </Link>
        </div>
      </Card>
    </div>
  );
}

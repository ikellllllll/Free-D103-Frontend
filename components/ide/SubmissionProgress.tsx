"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { Card } from "@/components/common/Card";
import { useRouteScope } from "@/components/routing/RouteScopeProvider";
import { feedbackApi } from "@/lib/api/feedbackApi";
import { mockApi } from "@/lib/api/mockApi";
import { isBackendSessionId, sessionApi } from "@/lib/api/sessionApi";

type StepState = "done" | "current" | "pending";

export function SubmissionProgress({ submissionId }: { submissionId: string }) {
  const router = useRouter();
  const { withPrefix } = useRouteScope();
  const isBackendExecution = isBackendSessionId(submissionId);
  const {
    data: submission,
    isLoading,
    isError,
    failureCount: submissionFailureCount,
    refetch: refetchSubmission
  } = useQuery({
    queryKey: ["submission", submissionId],
    queryFn: () =>
      isBackendExecution
        ? sessionApi.getSubmissionResult(submissionId)
        : mockApi.getSubmission(submissionId),
    // COMPLETED 또는 errorCount >= 3 이면 stop (404/500 무한 폴링 차단)
    refetchInterval: (query) => {
      if (query.state.data?.status === "COMPLETED") return false;
      if (query.state.errorUpdateCount >= 3) return false;
      return 1200;
    }
  });
  const {
    data: report,
    failureCount: reportFailureCount,
    refetch: refetchReport
  } = useQuery({
    queryKey: ["report", submissionId],
    queryFn: () => feedbackApi.getFeedbackReport(submissionId),
    refetchInterval: (query) => {
      if (query.state.data?.status === "COMPLETED") return false;
      if (query.state.errorUpdateCount >= 3) return false;
      return 1200;
    }
  });

  // 폴링이 errorUpdateCount 가드로 멈췄는지 감지 — 멈춘 상태라면 자동 라우팅이 영원히 안 일어남.
  // 사용자에게 "응답이 지연되고 있어요 / 다시 시도" UI 를 보여줘서 영구 정지 상태를 풀 수 있게 한다.
  // (단, 데이터가 이미 COMPLETED 면 stalled 가 의미 없음 — overallDone 분기가 별도로 라우팅 처리.)
  const submissionStalled =
    submissionFailureCount >= 3 && submission?.status !== "COMPLETED";
  const reportStalled =
    reportFailureCount >= 3 && report?.status !== "COMPLETED";
  const isStalled = submissionStalled || reportStalled;

  const handleRetryStalled = () => {
    if (submissionStalled) void refetchSubmission();
    if (reportStalled) void refetchReport();
  };

  const steps = useMemo(() => {
    const completed = submission?.status === "COMPLETED";
    const reportCompleted = report?.status === "COMPLETED";

    return [
      {
        label: "코드 채점 중",
        description: "테스트 케이스를 실행하고 제출물을 검증하고 있습니다.",
        state: (completed || reportCompleted ? "done" : "current") as StepState
      },
      {
        label: "코드 리뷰 분석 중",
        description: "설계 일관성, 예외 처리, 구현 완성도를 점검하고 있습니다.",
        state: (reportCompleted ? "done" : completed ? "current" : "pending") as StepState
      },
      {
        label: "AI 활용 분석 중",
        description: "Trace를 바탕으로 프롬프트 명확성과 자기 주도성을 종합하고 있습니다.",
        state: (reportCompleted ? "done" : completed ? "current" : "pending") as StepState
      }
    ];
  }, [report?.status, submission?.status]);

  const overallDone = report?.status === "COMPLETED";

  useEffect(() => {
    if (!overallDone) return;
    const timer = window.setTimeout(() => {
      router.replace(withPrefix(`/submissions/${submissionId}/report`));
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [overallDone, router, submissionId, withPrefix]);

  if (isLoading) {
    return (
      <div className="center-shell">
        <div className="loader-card">
          <span className="eyebrow">제출 상태</span>
          <strong>제출 상태를 확인하고 있습니다.</strong>
        </div>
      </div>
    );
  }

  if (isError || !submission) {
    return (
      <div className="center-shell">
        <div className="loader-card">
          <span className="eyebrow">오류</span>
          <strong>제출 정보를 불러올 수 없습니다.</strong>
          <Link href={withPrefix("/problems")} className="button" style={{ marginTop: 8 }}>
            과제 목록으로
          </Link>
        </div>
      </div>
    );
  }
  const doneCount = steps.filter((s) => s.state === "done").length;

  return (
    <div className="narrow-shell submission-shell">
      <Card className="glow-card submission-card">
        <div className="submission-card__head">
          <span className="eyebrow">제출 진행</span>
          <h1>제출물을 분석하고 있습니다</h1>
          <p className="muted-copy submission-card__desc">
            제출 ID #{submission.id} 기준으로 테스트 채점, 코드 리뷰, AI 활용 분석 단계를
            순차적으로 처리하고 있습니다.
          </p>
        </div>

        <div className="submission-progress-bar">
          <div className="submission-progress-bar__head">
            <strong>
              {overallDone
                ? "분석 완료"
                : isStalled
                  ? "응답이 지연되고 있어요"
                  : "분석 진행 중"}
            </strong>
            <span className="submission-progress-bar__pct">{doneCount} / {steps.length} 단계</span>
          </div>
          <div className="progress-bar progress-bar--lg">
            <span style={{ width: `${Math.round((doneCount / steps.length) * 100)}%` }} />
          </div>
        </div>

        {isStalled && !overallDone ? (
          <div
            className="submission-stalled"
            style={{
              padding: "12px 14px",
              borderRadius: 10,
              background: "rgba(244, 63, 94, 0.08)",
              border: "1px solid rgba(244, 63, 94, 0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              fontSize: "0.85rem"
            }}
          >
            <span style={{ color: "#be123c" }}>
              서버 응답이 지연되고 있습니다. 다시 시도하거나 리포트 페이지에서 직접 확인하세요.
            </span>
            <button
              type="button"
              onClick={handleRetryStalled}
              className="button button--ghost"
              style={{ flexShrink: 0 }}
            >
              다시 시도
            </button>
          </div>
        ) : null}

        <div className="submission-steps">
          {steps.map((step, i) => (
            <div key={step.label} className={`submission-step submission-step--${step.state}`}>
              <div className="submission-step__track">
                <div className="submission-step__icon" aria-hidden>
                  {step.state === "done" ? (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <span>{i + 1}</span>
                  )}
                </div>
                {i < steps.length - 1 && <div className="submission-step__line" />}
              </div>
              <div className="submission-step__body">
                <strong>{step.label}</strong>
                <p>{step.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="submission-meta">
          <div className="submission-meta__item">
            <span className="submission-meta__label">제출 상태</span>
            <strong className="submission-meta__value">
              {submission.status === "COMPLETED" ? "분석 완료" : "처리 중"}
            </strong>
          </div>
          <div className="submission-meta__item">
            <span className="submission-meta__label">제출 시간</span>
            <strong className="submission-meta__value">
              {new Date(submission.submittedAt).toLocaleTimeString("ko-KR")}
            </strong>
          </div>
          <div className="submission-meta__item">
            <span className="submission-meta__label">리포트 상태</span>
            <strong className="submission-meta__value">
              {report?.status === "COMPLETED" ? "완료" : "생성 중"}
            </strong>
          </div>
        </div>

        {overallDone && (
          <p className="muted-copy" style={{ fontSize: "0.82rem", textAlign: "center" }}>
            분석이 완료되었습니다. 잠시 후 리포트 페이지로 이동합니다…
          </p>
        )}

        <div className="submission-card__actions">
          <Link href={withPrefix("/problems")} className="button">
            과제 목록
          </Link>
          <Link
            href={withPrefix(`/submissions/${submissionId}/report`)}
            className="button button--primary"
          >
            리포트 보기
          </Link>
        </div>
      </Card>
    </div>
  );
}

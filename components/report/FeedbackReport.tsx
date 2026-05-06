"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/common/Badge";
import { Card } from "@/components/common/Card";
import { useRouteScope } from "@/components/routing/RouteScopeProvider";
import { feedbackApi } from "@/lib/api/feedbackApi";

const toneMap = {
  good: "green",
  mid: "teal",
  warn: "amber"
} as const;

export function FeedbackReport({ submissionId }: { submissionId: string }) {
  const { withPrefix } = useRouteScope();
  const { data: report, isLoading } = useQuery({
    queryKey: ["report", submissionId],
    queryFn: () => feedbackApi.getFeedbackReport(submissionId),
    refetchInterval: (query) => (query.state.data?.status === "COMPLETED" ? false : 1500)
  });

  if (isLoading || !report) {
    return (
      <div className="center-shell">
        <div className="loader-card">
          <span className="eyebrow">리포트 생성</span>
          <strong>피드백 리포트를 생성하고 있습니다.</strong>
        </div>
      </div>
    );
  }

  if (report.status !== "COMPLETED") {
    return (
      <div className="center-shell">
        <div className="loader-card">
          <span className="eyebrow">리포트 생성</span>
          <strong>코드와 Trace를 분석하는 중입니다.</strong>
        </div>
      </div>
    );
  }

  return (
    <div className="stack-24">
      <Card className="report-hero">
        <div>
          <span className="eyebrow">제출 #{submissionId}</span>
          <h1>{report.problemTitle ?? "피드백 리포트"}</h1>
          <p className="muted-copy">
            테스트 결과와 AI 활용 흐름을 함께 정리해, 무엇을 잘했고 무엇을 더 보완해야 하는지 한눈에 볼 수 있습니다.
          </p>
        </div>

        <div className="hero-actions">
          <Link href={withPrefix(`/submissions/${submissionId}/timeline`)} className="button">
            타임라인
          </Link>
          <Link href={withPrefix("/problems")} className="button button--primary">
            과제 목록
          </Link>
        </div>
      </Card>

      <div className="grid-2">
        <Card className="score-summary">
          <span className="eyebrow">테스트 결과</span>
          <strong>{report.testSummary}</strong>
          <div className="progress-bar">
            <span style={{ width: `${report.testPassRate}%` }} />
          </div>
          <small>{report.testPassRate}% · 공개/숨김 테스트 종합 결과</small>
        </Card>

        <Card>
          <span className="eyebrow">AI 분석</span>
          <h2>AI 활용 분석</h2>
          <div className="stack-16">
            {report.scores.map((score) => (
              <div key={score.label} className="score-row">
                <div className="score-row__head">
                  <span>{score.label}</span>
                  <Badge tone={toneMap[score.tone]}>{score.score}점</Badge>
                </div>
                <div className="progress-bar progress-bar--soft">
                  <span style={{ width: `${score.score}%` }} />
                </div>
                <small>{score.note}</small>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid-2">
        <Card>
          <span className="eyebrow">강점</span>
          <h2>잘한 점</h2>
          <ul className="bullet-list">
            {report.strengths.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Card>

        <Card>
          <span className="eyebrow">보완 포인트</span>
          <h2>개선 포인트</h2>
          <ul className="bullet-list">
            {report.improvements.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="summary-banner">
        <span className="eyebrow">한 줄 요약</span>
        <p>{report.summary}</p>
      </Card>

      <Card>
        <div className="section-head">
          <div>
            <span className="eyebrow">타임라인 미리보기</span>
            <h2>최근 풀이 흐름</h2>
          </div>
          <Link href={withPrefix(`/submissions/${submissionId}/timeline`)} className="text-link">
            타임라인 전체 보기
          </Link>
        </div>

        <div className="timeline-list">
          {report.timeline.map((event) => (
            <div key={event.id} className="timeline-item">
              <span className="timeline-item__time">{event.time}</span>
              <div className="timeline-item__body">
                <strong>{event.type}</strong>
                <span>{event.summary}</span>
                <small>{event.detail}</small>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

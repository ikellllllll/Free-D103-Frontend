"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/common/Badge";
import { Card } from "@/components/common/Card";
import { useRouteScope } from "@/components/routing/RouteScopeProvider";
import { feedbackApi } from "@/lib/api/feedbackApi";
import type { DimensionScoreItem, FindingItem, ScoreTone } from "@/lib/types/report";

const toneMap = {
  good: "green",
  mid: "teal",
  warn: "amber"
} as const;

/** severity 0~3 → 색상/라벨. 백엔드는 정수 (0=낮음 ~ 3=치명). */
const severityMeta = (severity: number) => {
  if (severity >= 3) return { tone: "amber" as const, label: "치명" };
  if (severity >= 2) return { tone: "teal" as const, label: "중요" };
  if (severity >= 1) return { tone: "green" as const, label: "보통" };
  return { tone: "green" as const, label: "참고" };
};

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

  const strengthFindings = report.findings.filter((f) => f.category === "STRENGTH");
  const improvementFindings = report.findings
    .filter((f) => f.category !== "STRENGTH")
    .sort((a, b) => b.severity - a.severity);
  const overallTone: ScoreTone =
    report.overallScore >= 80 ? "good" : report.overallScore >= 60 ? "mid" : "warn";

  return (
    <div className="stack-24">
      {/* A. Hero — 종합 점수 + 등급 + 진단 */}
      <Card className="report-hero">
        <div>
          <span className="eyebrow">제출 #{submissionId}</span>
          <h1>{report.problemTitle ?? "피드백 리포트"}</h1>
          <p className="muted-copy">
            테스트 결과와 AI 활용 흐름을 함께 정리해, 무엇을 잘했고 무엇을 더 보완해야 하는지 한눈에 볼 수 있습니다.
          </p>
        </div>

        <div className="report-hero__score">
          <div className={`report-overall report-overall--${overallTone}`}>
            <span className="report-overall__label">종합</span>
            <strong className="report-overall__value">{report.overallScore}</strong>
            <span className="report-overall__grade">{report.scoreGrade}</span>
          </div>
          {report.diagnosisLevel ? (
            <Badge tone={toneMap[overallTone]}>{report.diagnosisLevel}</Badge>
          ) : null}
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

      {/* B & C. 5축 점수 카드 + 테스트 결과 */}
      <div className="grid-2">
        <Card>
          <span className="eyebrow">AI 활용 5축</span>
          <h2>역량 평가</h2>
          <div className="stack-16">
            {report.dimensions.map((dimension) => (
              <DimensionRow key={dimension.code} dimension={dimension} />
            ))}
          </div>
        </Card>

        <Card className="score-summary">
          <span className="eyebrow">테스트 결과</span>
          <strong>{report.testSummary}</strong>
          <div className="progress-bar">
            <span style={{ width: `${report.testPassRate}%` }} />
          </div>
          <small>
            {report.testPassRate}% 통과
            {report.buildSucceeded === false ? " · 빌드 실패 포함" : ""}
          </small>

          {/* Trace 요약 (basis가 있을 때만) */}
          {report.basis?.usedRunTrace ? (
            <div className="report-basis-block">
              <span className="eyebrow">Trace 요약</span>
              <ul className="report-basis-list">
                <li>
                  <span>Span</span>
                  <strong>{report.basis.usedRunTrace.spanCount ?? 0}</strong>
                </li>
                <li>
                  <span>Tool</span>
                  <strong>{report.basis.usedRunTrace.toolCallCount ?? 0}</strong>
                </li>
                <li>
                  <span>LLM</span>
                  <strong>{report.basis.usedRunTrace.llmCallCount ?? 0}</strong>
                </li>
                <li>
                  <span>Patch</span>
                  <strong>{report.basis.usedRunTrace.patchCount ?? 0}</strong>
                </li>
              </ul>
            </div>
          ) : null}

          {/* 파일 변경 검토 요약 */}
          {report.basis?.usedFileChangeReviews ? (
            <div className="report-basis-block">
              <span className="eyebrow">파일 변경 검토</span>
              <ul className="report-basis-list report-basis-list--compact">
                <li>
                  <span>요청</span>
                  <strong>{report.basis.usedFileChangeReviews.changeRequestCount ?? 0}</strong>
                </li>
                <li>
                  <span>승인</span>
                  <strong>{report.basis.usedFileChangeReviews.approvedCount ?? 0}</strong>
                </li>
                <li>
                  <span>거절</span>
                  <strong>{report.basis.usedFileChangeReviews.rejectedCount ?? 0}</strong>
                </li>
              </ul>
            </div>
          ) : null}
        </Card>
      </div>

      {/* D. 액션 가이드 (priority 정렬) — 0개일 땐 숨김 */}
      {report.actionGuides.length > 0 ? (
        <Card>
          <span className="eyebrow">다음 액션</span>
          <h2>우선순위 가이드</h2>
          <div className="report-action-list">
            {report.actionGuides.map((guide) => (
              <div key={`${guide.priority}-${guide.title}`} className="report-action-card">
                <div className="report-action-card__head">
                  <span className="report-action-priority">{guide.priority}</span>
                  <strong>{guide.title}</strong>
                </div>
                {guide.description ? <p>{guide.description}</p> : null}
                {guide.expectedImpact ? (
                  <small className="report-action-impact">기대 효과 · {guide.expectedImpact}</small>
                ) : null}
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {/* E & F. Findings — 강점 / 개선 (severity 정렬) */}
      <div className="grid-2">
        <Card>
          <span className="eyebrow">강점</span>
          <h2>잘한 점</h2>
          {strengthFindings.length > 0 ? (
            <div className="report-finding-list">
              {strengthFindings.map((f) => (
                <FindingCard key={f.id} finding={f} />
              ))}
            </div>
          ) : (
            <ul className="bullet-list">
              {report.strengths.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <span className="eyebrow">보완 포인트</span>
          <h2>개선 포인트</h2>
          {improvementFindings.length > 0 ? (
            <div className="report-finding-list">
              {improvementFindings.map((f) => (
                <FindingCard key={f.id} finding={f} />
              ))}
            </div>
          ) : (
            <ul className="bullet-list">
              {report.improvements.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* G. 한 줄 요약 */}
      <Card className="summary-banner">
        <span className="eyebrow">한 줄 요약</span>
        <p>{report.summary}</p>
      </Card>

      {/* H. 평가 근거 — 하네스 파일 리스트 (작게) */}
      {report.basis?.usedHarnessFiles && report.basis.usedHarnessFiles.length > 0 ? (
        <Card>
          <span className="eyebrow">평가에 사용된 자료</span>
          <h2>하네스 파일</h2>
          <div className="report-harness-chip-list">
            {report.basis.usedHarnessFiles.map((path) => (
              <span key={path} className="report-harness-chip">
                {path}
              </span>
            ))}
          </div>
        </Card>
      ) : null}

      {/* I. 타임라인 미리보기 (기존 유지) */}
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

/* ─── Subcomponents ─── */

/** 5축 점수 한 행 — bar + 점수 배지 + rationale + (펼침) 강점/개선/추천. */
function DimensionRow({ dimension }: { dimension: DimensionScoreItem }) {
  const hasDetail =
    !!dimension.strengthSummary ||
    !!dimension.improvementSummary ||
    (dimension.recommendedActions?.length ?? 0) > 0;

  return (
    <details className="report-dimension" open={false}>
      <summary className="report-dimension__head">
        <div className="report-dimension__title">
          <span>{dimension.label}</span>
          <Badge tone={toneMap[dimension.tone]}>{dimension.score}점</Badge>
        </div>
        <div className="progress-bar progress-bar--soft">
          <span style={{ width: `${dimension.score}%` }} />
        </div>
        {dimension.rationale ? (
          <small className="report-dimension__rationale">{dimension.rationale}</small>
        ) : null}
      </summary>

      {hasDetail ? (
        <div className="report-dimension__detail">
          {dimension.strengthSummary ? (
            <div>
              <span className="eyebrow eyebrow--good">강점</span>
              <p>{dimension.strengthSummary}</p>
            </div>
          ) : null}
          {dimension.improvementSummary ? (
            <div>
              <span className="eyebrow eyebrow--warn">개선</span>
              <p>{dimension.improvementSummary}</p>
            </div>
          ) : null}
          {dimension.recommendedActions && dimension.recommendedActions.length > 0 ? (
            <div>
              <span className="eyebrow">추천 행동</span>
              <ul className="bullet-list">
                {dimension.recommendedActions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </details>
  );
}

/** Finding 한 카드 — title + severity 배지 + description + recommendation. */
function FindingCard({ finding }: { finding: FindingItem }) {
  const sev = severityMeta(finding.severity);
  const isStrength = finding.category === "STRENGTH";
  return (
    <div className={`report-finding-card report-finding-card--${isStrength ? "strength" : "improvement"}`}>
      <div className="report-finding-card__head">
        <strong>{finding.title}</strong>
        {!isStrength ? <Badge tone={sev.tone}>{sev.label}</Badge> : null}
      </div>
      {finding.description ? <p>{finding.description}</p> : null}
      {finding.recommendation ? (
        <small className="report-finding-card__rec">💡 {finding.recommendation}</small>
      ) : null}
    </div>
  );
}

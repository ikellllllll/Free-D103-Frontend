"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/common/Badge";
import { Card } from "@/components/common/Card";
import type { SubmissionResult } from "@/lib/types/session";

interface Props {
  result: SubmissionResult | null;
  loading: boolean;
}

/**
 * IDE 하단 트레이의 "제출" 탭 본문.
 * 백엔드가 진행률을 안 줘서 elapsed 시간만 정직하게 표시한다.
 * 응답에 publicPassedCount/hiddenPassedCount 가 들어오면 공개·비공개 카드 분리.
 * 안 들어오면 합산 카드로 fallback.
 */
export function SubmissionResultPanel({ result, loading }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!loading) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [loading]);

  if (!result) {
    return (
      <div className="bottom-panel__body">
        <div className="empty-inline">아직 제출하지 않았습니다. 상단의 &quot;제출&quot; 버튼을 눌러보세요.</div>
      </div>
    );
  }

  const isRunning = result.rawStatus === "RUNNING";
  const isFailed = result.rawStatus === "FAILED";
  const isCompleted = result.rawStatus === "COMPLETED";

  const liveNow = result.endedAt ?? (isRunning ? now : result.startedAt);
  const elapsedMs = Math.max(0, liveNow - result.startedAt);
  const elapsedSec = (elapsedMs / 1000).toFixed(1);

  const passRatePct = Math.round((result.passRate || 0) * (result.passRate <= 1 ? 100 : 1));
  const shortId = result.executionId.length > 8 ? result.executionId.slice(0, 8) : result.executionId;

  // 백엔드가 public/hidden 분리 카운트를 줬는지 — 있으면 split 카드 모드
  const hasSplit =
    typeof result.publicTotal === "number" || typeof result.hiddenTotal === "number";

  return (
    <div className="bottom-panel__body">
      <div className="bottom-summary">
        <strong>
          제출 #{shortId} ·{" "}
          {isRunning ? (
            <Badge tone="amber">진행 중</Badge>
          ) : isCompleted ? (
            <Badge tone="green">완료</Badge>
          ) : (
            <Badge tone="red">실패</Badge>
          )}
        </strong>
        <span>
          {isRunning ? `채점 중 · ${elapsedSec}초 경과` : `소요 ${elapsedSec}초`}
        </span>
      </div>

      <div className="stack-12">
        {hasSplit ? (
          <SplitPassCards
            publicPassed={result.publicPassed ?? 0}
            publicTotal={result.publicTotal ?? 0}
            hiddenPassed={result.hiddenPassed ?? 0}
            hiddenTotal={result.hiddenTotal ?? 0}
            isCompleted={isCompleted}
            isFailed={isFailed}
          />
        ) : (
          <div className="output-grid">
            <Card className="mini-panel mini-panel--flat">
              <strong>통과</strong>
              <pre style={{ fontSize: "1.4rem", margin: 0 }}>
                {result.passed} / {result.total}
              </pre>
              <small>
                {isCompleted ? `${passRatePct}% 통과` : isFailed ? "채점 중단" : "집계 중"}
              </small>
            </Card>

            <Card className="mini-panel mini-panel--flat">
              <strong>실패</strong>
              <pre style={{ fontSize: "1.4rem", margin: 0 }}>{result.failed}</pre>
              <small>
                {isCompleted && result.failed === 0
                  ? "모든 케이스 통과"
                  : isCompleted
                    ? "비공개 포함"
                    : isFailed
                      ? "실행 단계 실패"
                      : "—"}
              </small>
            </Card>
          </div>
        )}

        {isFailed ? (
          <div className="empty-inline" style={{ borderColor: "rgba(220,38,38,0.32)" }}>
            실행 중 오류로 채점이 중단됐습니다. 비공개 테스트가 섞여 있어 상세 stderr 는 노출되지 않습니다.
            상단 &quot;테스트&quot; 버튼으로 공개 테스트만 다시 돌리면 stdout · stderr 를 확인할 수 있습니다.
          </div>
        ) : isRunning ? (
          <div className="empty-inline">
            도커 러너에서 공개·비공개 테스트를 함께 채점 중입니다. 백엔드가 진행률을 노출하지 않아 경과 시간만 표시합니다.
          </div>
        ) : (
          <div className="empty-inline">
            제출 채점은 비공개(hidden) 테스트가 포함되어 있어, 어느 케이스가 실패했는지는 표시되지 않습니다.
            공개 테스트 결과만 보고 싶으면 상단 &quot;테스트&quot; 버튼을 사용하세요.
          </div>
        )}
      </div>
    </div>
  );
}

interface SplitProps {
  publicPassed: number;
  publicTotal: number;
  hiddenPassed: number;
  hiddenTotal: number;
  isCompleted: boolean;
  isFailed: boolean;
}

/**
 * 공개·비공개 분리 카드.
 * UX 의도: 사용자가 "공개부터 fail 인지 / 히든만 fail 인지" 한눈에 보고 다음 액션 결정.
 */
function SplitPassCards({
  publicPassed,
  publicTotal,
  hiddenPassed,
  hiddenTotal,
  isCompleted,
  isFailed
}: SplitProps) {
  const ratio = (passed: number, total: number) =>
    total > 0 ? Math.round((passed / total) * 100) : 0;

  const subText = (passed: number, total: number) => {
    if (isFailed) return "채점 중단";
    if (!isCompleted) return "집계 중";
    if (total === 0) return "케이스 없음";
    if (passed === total) return "모두 통과";
    return `${ratio(passed, total)}% 통과`;
  };

  return (
    <div className="output-grid">
      <Card className="mini-panel mini-panel--flat">
        <strong>공개 테스트</strong>
        <pre style={{ fontSize: "1.4rem", margin: 0 }}>
          {publicPassed} / {publicTotal}
        </pre>
        <small>{subText(publicPassed, publicTotal)}</small>
      </Card>

      <Card className="mini-panel mini-panel--flat">
        <strong>비공개 테스트</strong>
        <pre style={{ fontSize: "1.4rem", margin: 0 }}>
          {hiddenPassed} / {hiddenTotal}
        </pre>
        <small>{subText(hiddenPassed, hiddenTotal)}</small>
      </Card>
    </div>
  );
}

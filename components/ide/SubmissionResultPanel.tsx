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
 * 백엔드 응답 확장 (stdout/stderr/results) 후엔 실패 테케 리스트를 추가할 자리.
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
        <div className="output-grid">
          <Card className="mini-panel mini-panel--flat">
            <strong>통과</strong>
            <pre style={{ fontSize: "1.4rem", margin: 0 }}>
              {result.passed} / {result.total}
            </pre>
            <small>{isCompleted ? `${passRatePct}% 통과` : isFailed ? "채점 중단" : "집계 중"}</small>
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

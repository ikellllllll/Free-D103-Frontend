"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Card } from "@/components/common/Card";
import { feedbackApi, isBackendFeedbackReportId } from "@/lib/api/feedbackApi";
import { mockApi } from "@/lib/api/mockApi";

export function TimelineBoard({ submissionId }: { submissionId: string }) {
  const { data: timeline = [], isLoading } = useQuery({
    queryKey: ["timeline", submissionId],
    queryFn: async () => {
      if (!isBackendFeedbackReportId(submissionId)) {
        return mockApi.getTimeline(submissionId);
      }
      const report = await feedbackApi.getFeedbackReport(submissionId);
      return report.timeline;
    },
    refetchInterval: (query) => (query.state.data?.length ? false : 1500)
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo(
    () => timeline.find((item) => item.id === selectedId) ?? timeline[0],
    [selectedId, timeline]
  );

  if (isLoading || !timeline.length) {
    return (
      <div className="center-shell">
        <div className="loader-card">
          <span className="eyebrow">타임라인</span>
          <strong>풀이 타임라인을 준비하고 있습니다.</strong>
        </div>
      </div>
    );
  }

  return (
    <div className="timeline-board">
      <Card className="timeline-board__list">
        <span className="eyebrow">Trace 이벤트</span>
        <h2>풀이 타임라인</h2>
        <div className="timeline-list">
          {timeline.map((event) => (
            <button
              type="button"
              key={event.id}
              className={
                selected?.id === event.id ? "timeline-item timeline-item--active" : "timeline-item"
              }
              onClick={() => setSelectedId(event.id)}
            >
              <span className="timeline-item__time">{event.time}</span>
              <div className="timeline-item__body">
                <strong>{event.type}</strong>
                <span>{event.summary}</span>
                <small>{event.detail}</small>
              </div>
            </button>
          ))}
        </div>
      </Card>

      <Card className="timeline-board__detail">
        <span className="eyebrow">선택 이벤트</span>
        <h2>
          {selected.time} · {selected.type}
        </h2>

        <div className="mini-panel">
          <strong>이벤트 요약</strong>
          <p className="muted-copy">{selected.summary}</p>
        </div>

        <div className="mini-panel">
          <strong>상세 정보</strong>
          <p className="muted-copy">{selected.detail ?? "추가 상세 정보가 없습니다."}</p>
        </div>
      </Card>
    </div>
  );
}

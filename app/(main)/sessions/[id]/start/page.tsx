"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { Card } from "@/components/common/Card";
import { useRouteScope } from "@/components/routing/RouteScopeProvider";
import { mockApi } from "@/lib/api/mockApi";
import { getProblemById } from "@/lib/mock-data";

export default function SessionStartPage({ params }: { params: { id: string } }) {
  const sessionId = params.id;
  const router = useRouter();
  const { withPrefix } = useRouteScope();
  const { data: session } = useQuery({
    queryKey: ["session", sessionId],
    queryFn: () => mockApi.getSession(sessionId),
    refetchInterval: (query) => (query.state.data?.status === "IN_PROGRESS" ? false : 500)
  });

  useEffect(() => {
    if (session?.status === "IN_PROGRESS") {
      const timer = window.setTimeout(() => {
        router.replace(withPrefix(`/ide/${sessionId}`));
      }, 500);

      return () => window.clearTimeout(timer);
    }
  }, [router, session?.status, sessionId, withPrefix]);

  const progress = useMemo(() => {
    if (!session) {
      return 15;
    }
    if (session.status === "IN_PROGRESS") {
      return 100;
    }

    const remain = Math.max(session.readyAt - Date.now(), 0);
    return Math.max(25, Math.min(90, 100 - Math.round(remain / 30)));
  }, [session]);

  const problem = getProblemById(session?.problemId ?? "todo-api");

  return (
    <div className="narrow-shell">
      <Card className="glow-card">
        <span className="eyebrow">세션 준비</span>
        <h1>풀이 환경을 준비하고 있습니다</h1>
        <p className="muted-copy">
          워크스페이스, 기본 파일, AI 문맥을 불러오는 중입니다. 준비가 끝나면 IDE로 자동 이동합니다.
        </p>

        <div className="submit-summary">
          <div>
            <span>과제</span>
            <strong>{problem?.title ?? "Todo API 구현"}</strong>
          </div>
          <div>
            <span>예상 소요</span>
            <strong>{problem?.estimate ?? "60분"}</strong>
          </div>
        </div>

        <div className="step-card step-card--current">
          <strong>환경 준비 {progress}%</strong>
          <p>준비가 완료되면 이 페이지에서 자동으로 IDE로 이동합니다.</p>
          <div className="progress-bar">
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="hero-actions">
          <Link href={withPrefix(`/problems/${problem?.id ?? "todo-api"}`)} className="button">
            과제로 돌아가기
          </Link>
          <Link href={withPrefix(`/ide/${sessionId}`)} className="button button--primary">
            IDE 바로 열기
          </Link>
        </div>
      </Card>
    </div>
  );
}

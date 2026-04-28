"use client";

import Link from "next/link";
import { use, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { Card } from "@/components/common/Card";
import { isV0ThemeTone, useDevTheme } from "@/components/dev/DevThemeContext";
import { useRouteScope } from "@/components/routing/RouteScopeProvider";
import { mockApi } from "@/lib/api/mockApi";
import { isBackendProblemId } from "@/lib/api/sessionApi";
import { problemApi } from "@/lib/api/problemApi";
import { getProblemById } from "@/lib/mock-data";

export default function SessionStartPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = use(params);
  const router = useRouter();
  const { currentPath, withPrefix } = useRouteScope();
  const { themeTone } = useDevTheme();
  const isV0 = currentPath.startsWith("/sessions/") && isV0ThemeTone(themeTone);

  const { data: session } = useQuery({
    queryKey: ["session", sessionId],
    queryFn: () => mockApi.getSession(sessionId),
    refetchInterval: (query) => (query.state.data?.status === "IN_PROGRESS" ? false : 500)
  });
  const isApiProblem = isBackendProblemId(session?.problemId ?? "");
  const { data: apiProblem } = useQuery({
    queryKey: ["problem", session?.problemId],
    queryFn: () => problemApi.getProblemDetail(session!.problemId),
    enabled: !!session?.problemId && isApiProblem
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

  const problem = apiProblem ?? getProblemById(session?.problemId ?? "todo-api");
  const languageLabel = session?.language === "python" ? "Python" : "Java";
  const modelLabel = session?.aiModel ?? "aig-default";
  const isReady = session?.status === "IN_PROGRESS";

  if (isV0) {
    return (
      <div className="pvxstart">
        <section className="pvxstart-hero">
          <p className="pvxstart-kicker">session prepare</p>
          <h1>{isReady ? "IDE로 이동할 준비가 끝났습니다" : "풀이 환경을 준비하고 있습니다"}</h1>
          <p>
            워크스페이스, 기본 파일, AI 컨텍스트를 한 번에 구성하는 중입니다.
            준비가 끝나면 자동으로 v0 IDE 화면으로 이동합니다.
          </p>
        </section>

        <div className="pvxstart-grid">
          <section className="pvxstart-panel pvxstart-panel--main">
            <div className="pvxstart-progress__head">
              <span>{isReady ? "ready" : "building workspace"}</span>
              <strong>{progress}%</strong>
            </div>
            <div className="pvxstart-progress" aria-label={`세션 준비율 ${progress}%`}>
              <span style={{ width: `${progress}%` }} />
            </div>
            <ol className="pvxstart-steps">
              <li className="is-done">
                <span />
                문제 컨텍스트 수집
              </li>
              <li className={progress >= 55 ? "is-done" : ""}>
                <span />
                스타터 파일 구성
              </li>
              <li className={isReady ? "is-done" : ""}>
                <span />
                IDE 연결 준비
              </li>
            </ol>
          </section>

          <aside className="pvxstart-panel pvxstart-panel--meta">
            <div className="pvxstart-meta">
              <span>과제</span>
              <strong>{problem?.title ?? "Todo API 구현"}</strong>
            </div>
            <div className="pvxstart-meta">
              <span>예상 소요</span>
              <strong>{problem?.estimate ?? "60분"}</strong>
            </div>
            <div className="pvxstart-meta">
              <span>풀이 언어</span>
              <strong>{languageLabel}</strong>
            </div>
            <div className="pvxstart-meta">
              <span>AI 모델</span>
              <strong>{modelLabel}</strong>
            </div>

            <div className="pvxstart-actions">
              <Link href={withPrefix(`/problems/${problem?.id ?? "todo-api"}`)} className="pvxstart-button">
                과제로 돌아가기
              </Link>
              <Link href={withPrefix(`/ide/${sessionId}`)} className="pvxstart-button pvxstart-button--primary">
                IDE 바로 열기
              </Link>
            </div>
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div className="narrow-shell session-start-shell">
      <Card className="glow-card session-start-card">
        <div className="session-start-card__head">
          <span className="eyebrow">세션 준비</span>
          <h1>풀이 환경을 준비하고 있습니다</h1>
          <p className="muted-copy session-start-card__desc">
            워크스페이스, 기본 파일, AI 컨텍스트를 불러오는 중입니다. 준비가 끝나면 IDE로 자동 이동합니다.
          </p>
        </div>

        <div className="session-info">
          <div className="session-info__item">
            <span className="session-info__label">과제</span>
            <strong className="session-info__value">{problem?.title ?? "Todo API 구현"}</strong>
          </div>
          <div className="session-info__item">
            <span className="session-info__label">예상 소요</span>
            <strong className="session-info__value">{problem?.estimate ?? "60분"}</strong>
          </div>
        </div>

        <div className="session-progress">
          <div className="session-progress__head">
            <strong>환경 준비 중</strong>
            <span className="session-progress__pct">{progress}%</span>
          </div>
          <div className="progress-bar progress-bar--lg">
            <span style={{ width: `${progress}%` }} />
          </div>
          <p className="session-progress__note">준비가 완료되면 이 페이지에서 자동으로 IDE로 이동합니다.</p>
        </div>

        <div className="session-start-card__actions">
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

"use client";

import Link from "next/link";
import { use, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Code2, Clock, ArrowLeft } from "lucide-react";

import { useRouteScope } from "@/components/routing/RouteScopeProvider";
import { mockApi } from "@/lib/api/mockApi";
import { isBackendProblemId } from "@/lib/api/sessionApi";
import { problemApi } from "@/lib/api/problemApi";
import { getProblemById } from "@/lib/mock-data";

export default function SessionStartPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: sessionId } = use(params);
  const router = useRouter();
  const { withPrefix } = useRouteScope();

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
    if (!session) return 15;
    if (session.status === "IN_PROGRESS") return 100;
    const remain = Math.max(session.readyAt - Date.now(), 0);
    return Math.max(25, Math.min(90, 100 - Math.round(remain / 30)));
  }, [session]);

  const problem = apiProblem ?? getProblemById(session?.problemId ?? "todo-api");

  return (
    <div className="bg-gradient-to-b from-indigo-50/30 via-white to-white min-h-screen">
      <div className="max-w-2xl mx-auto px-6 pt-28 pb-16">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xl p-10">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 mb-4">
              <Loader2 size={28} className="animate-spin" />
            </div>
            <h1 className="text-2xl md:text-3xl font-display font-bold text-gray-900 tracking-tight mb-2">
              세션 환경을 준비하고 있습니다
            </h1>
            <p className="text-sm text-gray-500 leading-relaxed">
              워크스페이스, 기본 파일, AI 문맥을 불러오는 중입니다.
              <br />
              준비가 끝나면 IDE로 자동 이동합니다.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                과제
              </div>
              <div className="text-sm font-semibold text-gray-900 truncate">
                {problem?.title ?? "Todo API 구현"}
              </div>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1 flex items-center space-x-1">
                <Clock size={10} />
                <span>예상 소요</span>
              </div>
              <div className="text-sm font-semibold text-gray-900">
                {problem?.estimate ?? "60분"}
              </div>
            </div>
          </div>

          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-700">환경 준비 중</span>
              <span className="text-sm font-bold text-indigo-600">{progress}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${progress}%`,
                  background: "linear-gradient(to right, #6366f1, #a855f7)"
                }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-2">
              준비가 완료되면 이 페이지에서 자동으로 IDE로 이동합니다.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href={withPrefix(`/problems/${problem?.id ?? "todo-api"}`)}
              className="flex-1 inline-flex items-center justify-center space-x-2 bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-2.5 rounded-xl transition-colors text-sm"
            >
              <ArrowLeft size={14} />
              <span>과제로 돌아가기</span>
            </Link>
            <Link
              href={withPrefix(`/ide/${sessionId}`)}
              className="flex-1 inline-flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
            >
              <Code2 size={14} />
              <span>IDE 바로 열기</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

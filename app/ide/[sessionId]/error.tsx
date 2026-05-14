"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";

/**
 * IDE 라우트 (/ide/[sessionId]) 전용 error boundary.
 *
 * IdeShell.tsx 는 ~5400 줄짜리 거대 컴포넌트라 외부 라이브러리 update / Monaco lifecycle race /
 * 백엔드 응답 schema drift 등으로 render-time exception 이 터질 위험이 가장 높다. 그게 root
 * boundary (app/error.tsx) 까지 튀면 사용자가 IDE 가 아닌 페이지 전체 에러 화면을 보게 되고,
 * 사이드바조차 사라져서 다른 세션으로 이동도 못 한다.
 *
 * 이 boundary 는 IDE 화면 자체만 대체한다. 사용자는 "세션 목록으로 돌아가기" 만으로 회복 가능.
 */
export default function IdeSegmentError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error("[ide:error]", error);
    }
  }, [error]);

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-gradient-to-br from-rose-50 via-white to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="w-full max-w-md flex flex-col items-center text-center px-6 py-12 border border-dashed border-red-200 dark:border-red-900/60 rounded-3xl bg-white/80 dark:bg-slate-900/70 backdrop-blur shadow-sm">
        <div className="w-14 h-14 mb-5 rounded-2xl bg-red-50 dark:bg-red-950/40 flex items-center justify-center">
          <AlertTriangle size={22} className="text-red-500" />
        </div>
        <span className="inline-flex items-center px-2.5 py-0.5 mb-3 rounded-full text-xs font-semibold uppercase tracking-wider bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400">
          IDE 오류
        </span>
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-2">
          작업 환경을 불러오지 못했어요
        </h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-6 max-w-sm break-words">
          {error.message || "에디터 로딩 중 문제가 발생했습니다. 다시 시도하거나 다른 세션으로 이동해 주세요."}
        </p>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold shadow-sm hover:bg-indigo-700 transition-colors cursor-pointer"
          >
            <RefreshCw size={14} />
            다시 시도
          </button>
          <Link
            href="/sessions"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <ArrowLeft size={14} />
            세션 목록
          </Link>
        </div>
      </div>
    </main>
  );
}

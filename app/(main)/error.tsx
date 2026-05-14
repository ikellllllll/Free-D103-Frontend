"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

/**
 * (main) 라우트 그룹 전용 error boundary.
 *
 * app/error.tsx 만 있으면 AppShell 까지 통째로 unmount 돼서 사용자가 사이드바/헤더 없이
 * 황량한 에러 화면만 보게 된다. (main) 그룹 안에서 발생한 render-time 에러는 layout.tsx
 * 가 유지되도록 이 boundary 가 잡는다.
 *
 * Next.js error boundary 규칙: client component, props 는 { error, reset } 고정.
 */
export default function MainSegmentError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 운영에서 모니터링 갖춰지면 여기서 Sentry/OTel 로 보낼 자리. 현재는 console 만.
    if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error("[main:error]", error);
    }
  }, [error]);

  return (
    <div className="max-w-2xl mx-auto px-6 pt-28 pb-16">
      <div className="border border-dashed border-red-200 dark:border-red-900/60 rounded-2xl bg-white dark:bg-slate-900/70 px-8 py-10 text-center shadow-sm">
        <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-red-50 dark:bg-red-950/40 flex items-center justify-center">
          <AlertTriangle size={20} className="text-red-500" />
        </div>
        <h1 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-1.5">
          페이지를 불러오지 못했어요
        </h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-6 break-words">
          {error.message || "잠시 후 다시 시도해 주세요."}
        </p>
        <div className="flex justify-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors cursor-pointer"
          >
            <RefreshCw size={13} />
            다시 시도
          </button>
          <Link
            href="/problems"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <Home size={13} />
            과제 목록
          </Link>
        </div>
      </div>
    </div>
  );
}

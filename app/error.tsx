"use client";

import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function GlobalError({
  error,
  reset
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-gradient-to-br from-indigo-50 via-white to-rose-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="w-full max-w-md flex flex-col items-center text-center px-6 py-12 sm:py-14 border border-dashed border-red-200 dark:border-red-900/60 rounded-3xl bg-white/80 dark:bg-slate-900/70 backdrop-blur shadow-sm animate-fade-in">
        <div className="w-14 h-14 mb-5 rounded-2xl bg-red-50 dark:bg-red-950/40 ring-1 ring-red-100 dark:ring-red-900/50 flex items-center justify-center">
          <AlertTriangle size={22} strokeWidth={2.2} className="text-red-500 dark:text-red-400" />
        </div>

        <span className="inline-flex items-center px-2.5 py-0.5 mb-3 rounded-full text-xs font-semibold uppercase tracking-wider bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 ring-1 ring-red-100 dark:ring-red-900/50">
          오류
        </span>

        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-slate-100 mb-2">
          예상하지 못한 문제가 발생했습니다.
        </h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-6 max-w-sm break-words">
          {error.message || "잠시 후 다시 시도해 주세요. 문제가 계속되면 페이지를 새로고침해 주세요."}
        </p>

        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold shadow-sm shadow-indigo-600/30 hover:bg-indigo-700 transition-colors cursor-pointer"
          >
            <RefreshCw size={14} strokeWidth={2.4} />
            다시 시도
          </button>
          <Link
            href="/problems"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <Home size={14} strokeWidth={2.4} />
            과제 목록
          </Link>
        </div>
      </div>
    </main>
  );
}

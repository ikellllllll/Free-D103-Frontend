import Link from "next/link";
import { Compass, ArrowRight } from "lucide-react";

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-gradient-to-br from-indigo-50 via-white to-rose-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="w-full max-w-md flex flex-col items-center text-center px-6 py-12 sm:py-14 border border-dashed border-gray-200 dark:border-slate-700 rounded-3xl bg-white/80 dark:bg-slate-900/70 backdrop-blur shadow-sm animate-fade-in">
        <div className="w-14 h-14 mb-5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 ring-1 ring-indigo-100 dark:ring-indigo-900/50 flex items-center justify-center">
          <Compass size={22} strokeWidth={2.2} className="text-indigo-500 dark:text-indigo-400" />
        </div>

        <span className="inline-flex items-center px-2.5 py-0.5 mb-3 rounded-full text-xs font-semibold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 ring-1 ring-indigo-100 dark:ring-indigo-900/50">
          404
        </span>

        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-slate-100 mb-2">
          찾을 수 없는 화면입니다.
        </h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-6 max-w-sm">
          과제 ID 또는 세션 경로가 올바르지 않거나 더 이상 존재하지 않습니다.
        </p>

        <Link
          href="/problems"
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold shadow-sm shadow-indigo-600/30 hover:bg-indigo-700 transition-colors cursor-pointer"
        >
          과제 목록으로 이동
          <ArrowRight size={14} strokeWidth={2.4} />
        </Link>
      </div>
    </main>
  );
}

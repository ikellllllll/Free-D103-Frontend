import { Sparkles, TestTube } from "lucide-react";

export default function Dev2HarnessPage() {
  return (
    <div className="bg-gradient-to-b from-indigo-50/30 via-white to-white min-h-screen">
      <div className="max-w-3xl mx-auto px-6 py-20">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xl p-10 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-600 mb-6">
            <TestTube size={32} strokeWidth={1.8} />
          </div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold mb-4">
            <Sparkles size={12} strokeWidth={2.4} />
            <span>Harness · 준비 중</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-gray-900 tracking-tight mb-3">
            하네스 엔지니어링 워크스페이스
          </h1>
          <p className="text-base text-gray-600 leading-relaxed mb-8 max-w-xl mx-auto">
            에이전트를 위한 지침, 컨텍스트, 실행 수단, 가드레일을 설계하고 검증합니다.
            <br />새 디자인으로 곧 공개됩니다.
          </p>
          <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span>v2 디자인으로 작업 중</span>
          </div>
        </div>
      </div>
    </div>
  );
}

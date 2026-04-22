"use client";

import Link from "next/link";
import { use, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Clock, FileText, Loader2 } from "lucide-react";

import { useRouteScope } from "@/components/routing/RouteScopeProvider";
import { mockApi } from "@/lib/api/mockApi";

export default function Dev2TimelinePage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: submissionId } = use(params);
  const { withPrefix } = useRouteScope();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: timeline = [], isLoading } = useQuery({
    queryKey: ["timeline", submissionId],
    queryFn: () => mockApi.getTimeline(submissionId),
    refetchInterval: (q) => (q.state.data?.length ? false : 1500)
  });

  const selected = useMemo(
    () => timeline.find((e) => e.id === selectedId) ?? timeline[0],
    [selectedId, timeline]
  );

  if (isLoading || !timeline.length) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <div className="inline-flex items-center space-x-2 text-gray-500">
          <Loader2 size={18} className="animate-spin" />
          <span>타임라인 준비 중…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-b from-indigo-50/30 via-white to-white min-h-screen">
      <div className="max-w-7xl mx-auto px-6 py-10">
        <Link
          href={withPrefix(`/submissions/${submissionId}/report`)}
          className="inline-flex items-center space-x-1.5 text-sm text-gray-500 hover:text-indigo-600 mb-6 transition-colors"
        >
          <ArrowLeft size={14} />
          <span>리포트로</span>
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-6">
          {/* Event list */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="inline-flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-indigo-600 mb-2">
              <Clock size={14} />
              <span>Trace 이벤트</span>
            </div>
            <h2 className="text-xl font-display font-bold text-gray-900 mb-5">풀이 타임라인</h2>

            <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-2">
              {timeline.map((event) => {
                const active = selected?.id === event.id;
                return (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => setSelectedId(event.id)}
                    className={`w-full flex items-start space-x-3 p-3 rounded-xl text-left transition-all ${
                      active
                        ? "bg-indigo-50 border border-indigo-200"
                        : "border border-transparent hover:bg-gray-50"
                    }`}
                  >
                    <span
                      className={`shrink-0 text-xs font-mono font-semibold min-w-[50px] ${
                        active ? "text-indigo-700" : "text-indigo-600"
                      }`}
                    >
                      {event.time}
                    </span>
                    <div className="flex-1 min-w-0">
                      <strong
                        className={`block text-sm mb-0.5 ${
                          active ? "text-indigo-900" : "text-gray-900"
                        }`}
                      >
                        {event.type}
                      </strong>
                      <span className="block text-sm text-gray-600 mb-0.5">{event.summary}</span>
                      <small className="block text-xs text-gray-400 truncate">{event.detail}</small>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Detail */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 lg:sticky lg:top-24 self-start">
            <div className="inline-flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-indigo-600 mb-2">
              <FileText size={14} />
              <span>선택 이벤트</span>
            </div>
            <h2 className="text-xl font-display font-bold text-gray-900 mb-5">
              {selected.time} · {selected.type}
            </h2>

            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-xl">
                <strong className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                  이벤트 요약
                </strong>
                <p className="text-sm text-gray-700 leading-relaxed">{selected.summary}</p>
              </div>

              <div className="p-4 bg-gray-50 rounded-xl">
                <strong className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                  상세 정보
                </strong>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {selected.detail ?? "추가 상세 정보가 없습니다."}
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

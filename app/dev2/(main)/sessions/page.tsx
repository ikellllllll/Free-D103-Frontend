"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpen, History, Plus, Sparkles } from "lucide-react";

import { LangIcon } from "@/components/common/LangIcon";
import { useRouteScope } from "@/components/routing/RouteScopeProvider";
import { mockApi } from "@/lib/api/mockApi";
import type { SessionListItem } from "@/lib/types/session";
import { useAuthStore } from "@/store/authStore";

type Filter = "all" | "IN_PROGRESS" | "SUBMITTED";

const FILTER_LABELS: Record<Filter, string> = {
  all: "전체",
  IN_PROGRESS: "진행 중",
  SUBMITTED: "완료"
};

const LEVEL_COLORS = {
  1: "bg-green-50 text-green-700 border-green-200",
  2: "bg-amber-50 text-amber-700 border-amber-200",
  3: "bg-rose-50 text-rose-700 border-rose-200"
} as const;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" });
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "오늘";
  if (days === 1) return "어제";
  if (days < 7) return `${days}일 전`;
  return formatDate(iso);
}

function SessionCard({ item }: { item: SessionListItem }) {
  const { withPrefix } = useRouteScope();
  const isDone = item.status === "SUBMITTED";
  const href = isDone
    ? item.submissionId
      ? withPrefix(`/submissions/${item.submissionId}/report`)
      : withPrefix("/sessions")
    : withPrefix(`/ide/${item.sessionId}`);

  return (
    <Link
      href={href}
      className="group block bg-white rounded-2xl border border-gray-100 p-6 hover:border-indigo-300 hover:shadow-lg transition-all"
    >
      <div className="flex items-center justify-between mb-3">
        <span
          className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${LEVEL_COLORS[item.problemLevel]}`}
        >
          Lv {item.problemLevel}
        </span>
        <span
          className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
            isDone
              ? "bg-green-50 text-green-700 border-green-200"
              : "bg-indigo-50 text-indigo-700 border-indigo-200"
          }`}
        >
          {isDone ? "완료" : "진행 중"}
        </span>
      </div>

      <h3 className="text-base font-semibold text-gray-900 mb-2 leading-tight">
        {item.problemTitle}
      </h3>

      <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500 mb-4">
        <LangIcon language={item.language} size={14} showLabel className="inline-flex" />
        <span className="text-gray-300">·</span>
        <span>{item.problemCategory}</span>
        <span className="text-gray-300">·</span>
        <span>AI {item.aiRequestCount}회</span>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-gray-100 text-xs">
        <span className="text-gray-500">
          {isDone
            ? `${formatDate(item.startedAt)} 시작 · ${item.endedAt ? formatDate(item.endedAt) : "-"} 완료`
            : `${formatRelative(item.startedAt)} 시작`}
        </span>
        <span className="flex items-center space-x-1 text-indigo-600 font-semibold group-hover:translate-x-0.5 transition-transform">
          <span>{isDone ? "리포트" : "이어하기"}</span>
          <ArrowRight size={12} strokeWidth={2.4} />
        </span>
      </div>
    </Link>
  );
}

function EmptyState({ filter }: { filter: Filter }) {
  const { withPrefix } = useRouteScope();
  const messages: Record<Filter, { title: string; desc: string }> = {
    all: { title: "아직 풀이 기록이 없어요", desc: "과제 목록에서 풀이를 시작해보세요." },
    IN_PROGRESS: { title: "진행 중인 과제가 없어요", desc: "과제 목록에서 새 풀이를 시작해보세요." },
    SUBMITTED: { title: "완료한 과제가 없어요", desc: "풀이를 제출하면 여기에 기록이 남아요." }
  };
  const { title, desc } = messages[filter];
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-20 border border-dashed border-gray-200 rounded-2xl bg-white">
      <History size={32} className="text-gray-300 mb-3" />
      <strong className="text-gray-700 mb-1">{title}</strong>
      <p className="text-sm text-gray-500 mb-5">{desc}</p>
      <Link
        href={withPrefix("/problems")}
        className="inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
      >
        <BookOpen size={14} />
        <span>과제 목록 보기</span>
      </Link>
    </div>
  );
}

export default function Dev2SessionsPage() {
  const { withPrefix } = useRouteScope();
  const user = useAuthStore((s) => s.user);
  const [filter, setFilter] = useState<Filter>("all");

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["sessions", user?.id],
    queryFn: () => mockApi.getSessions(user!.id),
    enabled: !!user
  });

  const filtered = sessions.filter((s) => filter === "all" || s.status === filter);
  const counts = {
    all: sessions.length,
    IN_PROGRESS: sessions.filter((s) => s.status === "IN_PROGRESS").length,
    SUBMITTED: sessions.filter((s) => s.status === "SUBMITTED").length
  };

  return (
    <div className="relative bg-gradient-to-b from-indigo-50/30 via-white to-white min-h-screen overflow-hidden">
      {/* Floating blobs */}
      <div className="absolute top-0 left-0 right-0 h-[400px] pointer-events-none overflow-hidden">
        <div className="orbit-blob w-80 h-80 bg-indigo-300/30 top-[-80px] right-[20%] animate-blob-1" />
        <div className="orbit-blob w-72 h-72 bg-purple-300/30 top-[-40px] left-[10%] animate-blob-2" />
        <div className="absolute inset-0 bg-grid-pattern opacity-40" />
      </div>

      <div className="relative max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8 animate-slide-up">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/80 backdrop-blur-sm border border-indigo-100 text-indigo-700 text-xs font-semibold mb-3 shadow-sm">
              <Sparkles size={12} strokeWidth={2.4} className="animate-dot-pulse" />
              <span>풀이 기록</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-display font-bold text-gray-900 tracking-tight">
              내 <span className="bg-gradient-to-r from-indigo-600 to-purple-600 text-gradient">세션</span>
            </h1>
            <p className="text-gray-600 mt-2">진행 중이거나 완료한 과제 풀이 목록입니다.</p>
          </div>
          <Link
            href={withPrefix("/problems")}
            className="inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-colors"
          >
            <Plus size={16} strokeWidth={2.4} />
            <span>새 과제 시작</span>
          </Link>
        </div>

        {/* Filter tabs */}
        <div className="flex flex-wrap gap-2 mb-6 p-1.5 bg-white rounded-2xl border border-gray-100 shadow-sm w-fit">
          {(["all", "IN_PROGRESS", "SUBMITTED"] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`flex items-center space-x-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                filter === f
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-gray-600 hover:text-indigo-600 hover:bg-gray-50"
              }`}
            >
              <span>{FILTER_LABELS[f]}</span>
              <span
                className={`text-xs px-1.5 py-0.5 rounded ${
                  filter === f ? "bg-indigo-700/40" : "bg-gray-100 text-gray-500"
                }`}
              >
                {counts[f]}
              </span>
            </button>
          ))}
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-gray-100 p-6 h-40 skeleton-shimmer"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 stagger-children">
            {filtered.length === 0 ? (
              <EmptyState filter={filter} />
            ) : (
              filtered.map((item) => (
                <div key={item.sessionId} className="animate-slide-up" style={{ animationFillMode: "both" }}>
                  <SessionCard item={item} />
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

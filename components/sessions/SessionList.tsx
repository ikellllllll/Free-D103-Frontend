"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/common/Badge";
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

const STATUS_TONE = {
  IN_PROGRESS: "accent",
  SUBMITTED: "green",
  CREATING: "neutral"
} as const;

const STATUS_LABEL = {
  IN_PROGRESS: "진행 중",
  SUBMITTED: "완료",
  CREATING: "준비 중"
} as const;

const LEVEL_TONE = {
  1: "level1",
  2: "level2",
  3: "level3"
} as const;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    month: "2-digit",
    day: "2-digit"
  });
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "오늘";
  if (days === 1) return "어제";
  if (days < 7) return `${days}일 전`;
  return formatDate(iso);
}

function SessionRow({ item }: { item: SessionListItem }) {
  const { withPrefix } = useRouteScope();
  const isDone = item.status === "SUBMITTED";
  const href = isDone
    ? item.submissionId
      ? withPrefix(`/submissions/${item.submissionId}/report`)
      : withPrefix("/sessions")
    : withPrefix(`/ide/${item.sessionId}`);

  return (
    <Link href={href} className="slist-row">
      <div className="slist-row__left">
        <div className="slist-row__badges">
          <Badge tone={LEVEL_TONE[item.problemLevel]}>Lv {item.problemLevel}</Badge>
          <span className="slist-row__cat">{item.problemCategory}</span>
        </div>
        <strong className="slist-row__title">{item.problemTitle}</strong>
        <div className="slist-row__meta">
          <span className="slist-lang-badge">
            {item.language === "python" ? "🐍 Python" : "☕ Java"}
          </span>
          <span className="slist-row__divider">·</span>
          <span>AI {item.aiRequestCount}회</span>
          <span className="slist-row__divider">·</span>
          {isDone ? (
            <span>
              {formatDate(item.startedAt)} 시작 · {item.endedAt ? formatDate(item.endedAt) : "-"} 완료
            </span>
          ) : (
            <span>{formatRelative(item.startedAt)} 시작</span>
          )}
          {item.passRate && (
            <>
              <span className="slist-row__divider">·</span>
              <span className="slist-row__pass">{item.passRate}</span>
            </>
          )}
        </div>
      </div>

      <div className="slist-row__right">
        <Badge tone={STATUS_TONE[item.status] ?? "neutral"}>
          {STATUS_LABEL[item.status] ?? item.status}
        </Badge>
        <span className="slist-row__action">
          {isDone ? "리포트 →" : "이어하기 →"}
        </span>
      </div>
    </Link>
  );
}

function EmptyState({ filter }: { filter: Filter }) {
  const { withPrefix } = useRouteScope();
  const messages: Record<Filter, { title: string; desc: string }> = {
    all: { title: "아직 풀이 기록이 없어요.", desc: "과제 목록에서 풀이를 시작해보세요." },
    IN_PROGRESS: { title: "진행 중인 과제가 없어요.", desc: "과제 목록에서 새 풀이를 시작해보세요." },
    SUBMITTED: { title: "완료한 과제가 없어요.", desc: "풀이를 제출하면 여기에 기록이 남아요." }
  };
  const { title, desc } = messages[filter];
  return (
    <div className="slist-empty">
      <strong>{title}</strong>
      <p>{desc}</p>
      <Link href={withPrefix("/problems")} className="button button--primary">
        과제 목록 보기
      </Link>
    </div>
  );
}

export function SessionList() {
  const { withPrefix } = useRouteScope();
  const user = useAuthStore((state) => state.user);
  const [filter, setFilter] = useState<Filter>("all");

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["sessions", user?.id],
    queryFn: () => mockApi.getSessions(user!.id),
    enabled: !!user
  });

  const filtered = sessions.filter((s) => {
    if (filter === "all") return true;
    return s.status === filter;
  });

  const counts = {
    all: sessions.length,
    IN_PROGRESS: sessions.filter((s) => s.status === "IN_PROGRESS").length,
    SUBMITTED: sessions.filter((s) => s.status === "SUBMITTED").length
  };

  return (
    <div className="stack-24">
      {/* Header */}
      <div className="page-header">
        <div>
          <span className="eyebrow">풀이 기록</span>
          <h1>내 세션</h1>
          <p className="muted-copy">진행 중이거나 완료한 과제 풀이 목록입니다.</p>
        </div>
        <Link href={withPrefix("/problems")} className="button">
          새 과제 시작
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="slist-filters">
        {(["all", "IN_PROGRESS", "SUBMITTED"] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            className={`slist-filter-tab${filter === f ? " slist-filter-tab--active" : ""}`}
            onClick={() => setFilter(f)}
          >
            {FILTER_LABELS[f]}
            <span className="slist-filter-tab__count">{counts[f]}</span>
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="center-shell">
          <div className="loader-card">
            <span className="eyebrow">불러오는 중</span>
            <strong>풀이 기록을 불러오고 있습니다.</strong>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState filter={filter} />
      ) : (
        <div className="slist-rows">
          {filtered.map((item) => (
            <SessionRow key={item.sessionId} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

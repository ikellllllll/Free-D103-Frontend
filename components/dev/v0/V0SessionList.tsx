"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CheckCircle2,
  CircleDot,
  Clock,
  Flame,
  LayoutGrid,
  List,
  Plus,
  Search,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";

import { LangIcon } from "@/components/common/LangIcon";
import { useRouteScope } from "@/components/routing/RouteScopeProvider";
import { mockApi } from "@/lib/api/mockApi";
import type { SessionListItem } from "@/lib/types/session";
import { useAuthStore } from "@/store/authStore";

type Filter = "all" | "IN_PROGRESS" | "SUBMITTED";
type ViewMode = "list" | "grid";

const FILTER_LABELS: Record<Filter, string> = {
  all: "전체",
  IN_PROGRESS: "진행 중",
  SUBMITTED: "완료",
};

const STATUS_LABEL: Record<string, string> = {
  IN_PROGRESS: "진행 중",
  SUBMITTED: "완료",
  CREATING: "준비 중",
};

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
function parsePassRate(raw: string | null): number | null {
  if (!raw) return null;
  const n = parseFloat(raw.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : null;
}

/* ── Magnetic card (cursor spotlight) ────────── */
function useSpotlight<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const onMove = (event: React.MouseEvent<T>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    el.style.setProperty("--sv4-mx", `${x}%`);
    el.style.setProperty("--sv4-my", `${y}%`);
  };
  return { ref, onMove };
}

/* ── Session card ─────────────────────────────── */
function SessionCard({ item, view }: { item: SessionListItem; view: ViewMode }) {
  const { withPrefix } = useRouteScope();
  const { ref, onMove } = useSpotlight<HTMLAnchorElement>();
  const isDone = item.status === "SUBMITTED";
  const href = isDone
    ? item.submissionId
      ? withPrefix(`/submissions/${item.submissionId}/report`)
      : withPrefix("/sessions")
    : withPrefix(`/ide/${item.sessionId}`);

  const pass = parsePassRate(item.passRate);

  return (
    <Link
      ref={ref}
      href={href}
      onMouseMove={onMove}
      className={`sv4-card sv4-card--${view} ${isDone ? "sv4-card--done" : "sv4-card--active"}`}
      data-level={item.problemLevel}
    >
      <span className="sv4-card__spot" aria-hidden />
      <span className="sv4-card__border" aria-hidden />

      <div className="sv4-card__head">
        <div className="sv4-card__chips">
          <span className={`sv4-level sv4-level--${item.problemLevel}`}>Lv {item.problemLevel}</span>
          <span className="sv4-cat">{item.problemCategory}</span>
        </div>

        <span className={`sv4-status sv4-status--${isDone ? "done" : "active"}`}>
          <span className="sv4-status__dot" />
          {STATUS_LABEL[item.status] ?? item.status}
        </span>
      </div>

      <h3 className="sv4-card__title">{item.problemTitle}</h3>

      <div className="sv4-card__meta">
        <span className="sv4-meta">
          <LangIcon language={item.language} size={13} showLabel />
        </span>
        <span className="sv4-meta">
          <Sparkles size={12} strokeWidth={2} />
          <span>AI {item.aiRequestCount}회</span>
        </span>
        <span className="sv4-meta">
          <Clock size={12} strokeWidth={2} />
          <span>
            {isDone
              ? `${formatDate(item.startedAt)} — ${item.endedAt ? formatDate(item.endedAt) : "—"}`
              : `${formatRelative(item.startedAt)} 시작`}
          </span>
        </span>
      </div>

      {pass !== null && (
        <div className="sv4-card__progress" aria-label={`통과율 ${pass}%`}>
          <div className="sv4-card__progress-track">
            <div className="sv4-card__progress-fill" style={{ width: `${pass}%` }} />
          </div>
          <span className="sv4-card__progress-label">
            <span>통과율</span>
            <strong>{pass.toFixed(0)}%</strong>
          </span>
        </div>
      )}

      <div className="sv4-card__foot">
        <span className="sv4-card__cta">
          {isDone ? "리포트 보기" : "이어하기"}
          <ArrowRight size={14} strokeWidth={2.2} />
        </span>
      </div>
    </Link>
  );
}

/* ── Stat tile ────────────────────────────────── */
function StatTile({
  icon,
  label,
  value,
  hint,
  pulse,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  hint?: string;
  pulse?: boolean;
  accent?: boolean;
}) {
  const { ref, onMove } = useSpotlight<HTMLDivElement>();
  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      className={`sv4-stat ${accent ? "sv4-stat--accent" : ""} ${pulse ? "sv4-stat--pulse" : ""}`}
    >
      <span className="sv4-card__spot" aria-hidden />
      <div className="sv4-stat__head">
        <span className="sv4-stat__icon" aria-hidden>
          {icon}
        </span>
        <span className="sv4-stat__label">{label}</span>
      </div>
      <div className="sv4-stat__value">
        {value}
        {pulse && <span className="sv4-stat__ping" aria-hidden />}
      </div>
      {hint && <div className="sv4-stat__hint">{hint}</div>}
    </div>
  );
}

/* ── Sliding tabs with physics indicator ──────── */
function FilterTabs({
  filter,
  counts,
  onChange,
}: {
  filter: Filter;
  counts: Record<Filter, number>;
  onChange: (f: Filter) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Partial<Record<Filter, HTMLButtonElement>>>({});
  const [indicator, setIndicator] = useState<{ x: number; w: number; ready: boolean }>({
    x: 0,
    w: 0,
    ready: false,
  });

  useLayoutEffect(() => {
    const btn = btnRefs.current[filter];
    const wrap = wrapRef.current;
    if (!btn || !wrap) return;
    const wrapRect = wrap.getBoundingClientRect();
    const rect = btn.getBoundingClientRect();
    setIndicator({ x: rect.left - wrapRect.left, w: rect.width, ready: true });
  }, [filter, counts]);

  return (
    <div ref={wrapRef} className="sv4-tabs" role="tablist" aria-label="세션 필터">
      {indicator.ready && (
        <span
          className="sv4-tabs__indicator"
          aria-hidden
          style={{ transform: `translate3d(${indicator.x}px, 0, 0)`, width: indicator.w }}
        />
      )}
      {(["all", "IN_PROGRESS", "SUBMITTED"] as Filter[]).map((f) => (
        <button
          key={f}
          ref={(node) => {
            if (node) btnRefs.current[f] = node;
          }}
          type="button"
          role="tab"
          aria-selected={filter === f}
          className={`sv4-tab ${filter === f ? "sv4-tab--active" : ""}`}
          onClick={() => onChange(f)}
        >
          {FILTER_LABELS[f]}
          <span className="sv4-tab__count">{counts[f]}</span>
        </button>
      ))}
    </div>
  );
}

/* ── Empty state ──────────────────────────────── */
function EmptyState({ filter }: { filter: Filter }) {
  const { withPrefix } = useRouteScope();
  const messages: Record<Filter, { title: string; desc: string }> = {
    all: { title: "아직 풀이 기록이 없습니다", desc: "첫 과제를 시작해 여정을 열어보세요." },
    IN_PROGRESS: { title: "진행 중인 과제가 없습니다", desc: "새 풀이를 시작해 이어서 도전해보세요." },
    SUBMITTED: { title: "완료한 과제가 없습니다", desc: "제출한 풀이는 리포트와 함께 여기에 기록됩니다." },
  };
  const { title, desc } = messages[filter];
  return (
    <div className="sv4-empty">
      <div className="sv4-empty__orb" aria-hidden>
        <div className="sv4-empty__orb-core" />
        <div className="sv4-empty__orb-ring" />
        <div className="sv4-empty__orb-ring sv4-empty__orb-ring--2" />
      </div>
      <p className="sv4-empty__title">{title}</p>
      <p className="sv4-empty__desc">{desc}</p>
      <Link href={withPrefix("/problems")} className="sv4-empty__cta">
        과제 목록 보기 <ArrowRight size={14} strokeWidth={2.2} />
      </Link>
    </div>
  );
}

/* ── Loading skeleton ─────────────────────────── */
function SessionSkeleton({ view }: { view: ViewMode }) {
  return (
    <div className={`sv4-card sv4-card--${view} sv4-card--skeleton`} aria-hidden>
      <span className="sv4-card__border" />
      <div className="sv4-card__head">
        <div className="sv4-skel sv4-skel--chip" />
        <div className="sv4-skel sv4-skel--chip" />
      </div>
      <div className="sv4-skel sv4-skel--title" />
      <div className="sv4-skel sv4-skel--line" />
      <div className="sv4-skel sv4-skel--bar" />
    </div>
  );
}

export function SessionList() {
  const { withPrefix } = useRouteScope();
  const user = useAuthStore((state) => state.user);
  const [filter, setFilter] = useState<Filter>("all");
  const [view, setView] = useState<ViewMode>("list");
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["sessions", user?.id],
    queryFn: () => mockApi.getSessions(user!.id),
    enabled: !!user,
  });

  // Press "/" to focus the search input
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "/" && document.activeElement?.tagName !== "INPUT") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const counts = useMemo(
    () => ({
      all: sessions.length,
      IN_PROGRESS: sessions.filter((s) => s.status === "IN_PROGRESS").length,
      SUBMITTED: sessions.filter((s) => s.status === "SUBMITTED").length,
    }),
    [sessions],
  );

  const avgAI = useMemo(() => {
    if (sessions.length === 0) return 0;
    return Math.round(
      sessions.reduce((sum, s) => sum + s.aiRequestCount, 0) / sessions.length,
    );
  }, [sessions]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sessions
      .filter((s) => filter === "all" || s.status === filter)
      .filter((s) =>
        q
          ? s.problemTitle.toLowerCase().includes(q) ||
            s.problemCategory.toLowerCase().includes(q) ||
            s.language.toLowerCase().includes(q)
          : true,
      );
  }, [sessions, filter, query]);

  return (
    <div className="sv4-page">
      {/* ── Hero ───────────────────────────────── */}
      <header className="sv4-hero">
        <div className="sv4-hero__copy">
          <span className="sv4-hero__eyebrow">
            <CircleDot size={10} strokeWidth={3} />
            Solve Sessions
          </span>
          <h1 className="sv4-hero__title">
            내 풀이의 흐름을
            <br />
            <span className="sv4-hero__title-accent">한눈에.</span>
          </h1>
          <p className="sv4-hero__desc">
            진행 중인 세션을 이어가고, 완료한 풀이의 리포트를 확인해 인사이트를 쌓아보세요.
          </p>
        </div>
        <Link href={withPrefix("/problems")} className="sv4-hero__cta">
          <Plus size={16} strokeWidth={2.4} />
          <span>새 과제 시작</span>
          <ArrowRight size={14} strokeWidth={2.2} className="sv4-hero__cta-arrow" />
        </Link>
      </header>

      {/* ── Stats ──────────────────────────────── */}
      <section className="sv4-stats" aria-label="세션 요약">
        <StatTile
          icon={<TrendingUp size={15} strokeWidth={2.2} />}
          label="전체 세션"
          value={counts.all}
          hint="누적 풀이"
        />
        <StatTile
          icon={<Zap size={15} strokeWidth={2.2} />}
          label="진행 중"
          value={counts.IN_PROGRESS}
          hint={counts.IN_PROGRESS > 0 ? "지금 이어가기" : "대기 없음"}
          pulse={counts.IN_PROGRESS > 0}
          accent
        />
        <StatTile
          icon={<CheckCircle2 size={15} strokeWidth={2.2} />}
          label="완료"
          value={counts.SUBMITTED}
          hint="제출 완료"
        />
        <StatTile
          icon={<Flame size={15} strokeWidth={2.2} />}
          label="평균 AI 사용"
          value={avgAI}
          hint="세션당 요청 수"
        />
      </section>

      {/* ── Toolbar ────────────────────────────── */}
      <div className="sv4-toolbar">
        <label className="sv4-search" htmlFor="sv4-search">
          <Search size={14} strokeWidth={2.2} />
          <input
            id="sv4-search"
            ref={searchRef}
            type="search"
            className="sv4-search__input"
            placeholder="과제 제목 · 카테고리 · 언어 검색"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="sv4-search__kbd">/</kbd>
        </label>

        <FilterTabs filter={filter} counts={counts} onChange={setFilter} />

        <div className="sv4-view" role="group" aria-label="보기 모드">
          <button
            type="button"
            className={`sv4-view__btn ${view === "list" ? "sv4-view__btn--active" : ""}`}
            onClick={() => setView("list")}
            aria-pressed={view === "list"}
            aria-label="목록 보기"
          >
            <List size={14} strokeWidth={2.2} />
          </button>
          <button
            type="button"
            className={`sv4-view__btn ${view === "grid" ? "sv4-view__btn--active" : ""}`}
            onClick={() => setView("grid")}
            aria-pressed={view === "grid"}
            aria-label="카드 보기"
          >
            <LayoutGrid size={14} strokeWidth={2.2} />
          </button>
          <span
            className="sv4-view__indicator"
            aria-hidden
            style={{ transform: `translateX(${view === "grid" ? 100 : 0}%)` }}
          />
        </div>
      </div>

      {/* ── Results count ──────────────────────── */}
      <div className="sv4-results">
        <span className="sv4-results__count">
          <strong>{filtered.length}</strong>
          <span>개 세션</span>
        </span>
        {query && (
          <button type="button" className="sv4-results__clear" onClick={() => setQuery("")}>
            검색 초기화
          </button>
        )}
      </div>

      {/* ── Content ────────────────────────────── */}
      {isLoading ? (
        <div className={`sv4-grid sv4-grid--${view}`}>
          <SessionSkeleton view={view} />
          <SessionSkeleton view={view} />
          <SessionSkeleton view={view} />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState filter={filter} />
      ) : (
        <div className={`sv4-grid sv4-grid--${view}`}>
          {filtered.map((item) => (
            <SessionCard key={item.sessionId} item={item} view={view} />
          ))}
        </div>
      )}
    </div>
  );
}

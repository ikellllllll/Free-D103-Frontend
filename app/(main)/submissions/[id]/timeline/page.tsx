"use client";

import Link from "next/link";
import { use, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Loader2,
  Sparkles,
  Wrench,
  Code2,
  Check,
  Copy,
  Clock,
  Cpu,
  Hash,
  CalendarClock,
  ListCollapse,
  type LucideIcon
} from "lucide-react";

import { useRouteScope } from "@/components/routing/RouteScopeProvider";
import { feedbackApi, isBackendFeedbackReportId } from "@/lib/api/feedbackApi";
import { mockApi } from "@/lib/api/mockApi";
import type { TraceEvent, TraceType } from "@/lib/types/ai";

/* ─── Classification ─── */

type SpanKind = "llm" | "tool" | "patch";

const KIND_CONFIG: Record<
  SpanKind,
  {
    label: string;
    icon: LucideIcon;
    tint: string; // bg for chip
    text: string; // text color on chip
    accent: string; // solid accent bg for selected/header
    dot: string; // bar color in gantt
    tintSoft: string; // very soft bg (for row chip bg)
  }
> = {
  llm: {
    label: "LLM",
    icon: Sparkles,
    tint: "bg-violet-100",
    text: "text-violet-700",
    accent: "bg-violet-500",
    dot: "#A78BFA",
    tintSoft: "bg-violet-50"
  },
  tool: {
    label: "Tool",
    icon: Wrench,
    tint: "bg-teal-100",
    text: "text-teal-700",
    accent: "bg-teal-500",
    dot: "#5EEAD4",
    tintSoft: "bg-teal-50"
  },
  patch: {
    label: "Patch",
    icon: Code2,
    tint: "bg-amber-100",
    text: "text-amber-700",
    accent: "bg-amber-500",
    dot: "#FCD34D",
    tintSoft: "bg-amber-50"
  }
};

function classifyEvent(t: TraceType): SpanKind {
  if (t === "AI 요청" || t === "AI 응답") return "llm";
  if (t === "코드 수정") return "patch";
  return "tool"; // 실행, 테스트, 제출
}

/* ─── Synthetic rich span derived from TraceEvent ─── */

type Span = {
  id: string;
  kind: SpanKind;
  name: string; // e.g. "plan-next-step"
  subLabel: string; // e.g. "CLAUDE_4_5_SONNET · 1.2s"
  time: string; // "14:22:18"
  durationMs: number;
  startedMs: number; // relative start ms from first span
  model: string;
  tokensIn: number;
  tokensOut: number;
  status: number; // 200
  task: string; // human summary
  promptSummary: string; // detail
  logs: { t: string; msg: string; kind: SpanKind }[];
  outputJson: Record<string, unknown>;
  original: TraceEvent;
};

function hashInt(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

function synthesize(events: TraceEvent[]): Span[] {
  let cursor = 0;
  return events.map((e) => {
    const kind = classifyEvent(e.type);
    const h = hashInt(e.id);
    // Duration: LLM 600-1600ms, Tool 80-420ms, Patch 80-200ms
    const duration =
      kind === "llm"
        ? 600 + (h % 1000)
        : kind === "patch"
          ? 80 + (h % 120)
          : 80 + (h % 340);
    const startedMs = cursor;
    cursor += duration;

    const baseName = e.summary.length > 36 ? `${e.summary.slice(0, 36)}…` : e.summary;
    const name = kind === "llm"
      ? baseName.replace(/\s+/g, "-").toLowerCase().replace(/[^a-z0-9가-힣-]/g, "")
      : baseName;

    const model =
      kind === "llm"
        ? "CLAUDE_4_5_SONNET"
        : kind === "patch"
          ? "retry-patch"
          : "http-client";

    const subLabel = `${model} · ${(duration / 1000).toFixed(duration < 1000 ? 2 : 1).replace(/\.0$/, "")}s`;

    const tokensIn = kind === "llm" ? 800 + (h % 600) : 0;
    const tokensOut = kind === "llm" ? 200 + (h % 400) : 0;

    const status = 200;

    const logs = [
      { t: e.time, msg: `Span started · ${e.type}`, kind },
      {
        t: bumpTime(e.time, 0.2),
        msg:
          kind === "llm"
            ? `Called model ${model}`
            : kind === "tool"
              ? "HTTP request dispatched"
              : "Patch prepared",
        kind
      },
      {
        t: bumpTime(e.time, 0.6),
        msg:
          kind === "llm"
            ? `Received ${tokensOut} output tokens`
            : kind === "tool"
              ? "Response 200 OK"
              : "Patch applied to worktree",
        kind
      },
      { t: bumpTime(e.time, 0.9), msg: "Span completed", kind }
    ];

    const outputJson: Record<string, unknown> =
      kind === "llm"
        ? {
            next_steps: ["Inspect refresh token flow", "Re-run /api/me with token"],
            confidence: Number((0.55 + (h % 40) / 100).toFixed(2)),
            reasoning: e.detail ?? e.summary
          }
        : kind === "tool"
          ? {
              status: 200,
              latencyMs: duration,
              summary: e.summary
            }
          : {
              files_changed: 1,
              diff_summary: e.summary
            };

    return {
      id: e.id,
      kind,
      name,
      subLabel,
      time: e.time,
      durationMs: duration,
      startedMs,
      model,
      tokensIn,
      tokensOut,
      status,
      task: e.summary,
      promptSummary: e.detail ?? "추가 맥락 정보가 없습니다.",
      logs,
      outputJson,
      original: e
    };
  });
}

function bumpTime(t: string, fraction: number) {
  // t is "HH:MM:SS" — bump seconds by fraction * 1 second for visual variety
  const parts = t.split(":");
  if (parts.length !== 3) return t;
  const secs =
    parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10);
  const bumped = secs + Math.round(fraction);
  const hh = String(Math.floor(bumped / 3600) % 24).padStart(2, "0");
  const mm = String(Math.floor((bumped % 3600) / 60)).padStart(2, "0");
  const ss = String(bumped % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

/* ─── Component ─── */

export default function Dev2TimelinePage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: submissionId } = use(params);
  const { withPrefix } = useRouteScope();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeKinds, setActiveKinds] = useState<Set<SpanKind>>(
    new Set(["llm", "tool", "patch"])
  );
  const [tab, setTab] = useState<"input" | "output" | "logs">("input");
  const [collapsed, setCollapsed] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  const { data: timeline = [], isLoading, isError } = useQuery({
    queryKey: ["timeline", submissionId],
    queryFn: async () => {
      if (!isBackendFeedbackReportId(submissionId)) {
        return mockApi.getTimeline(submissionId);
      }
      const report = await feedbackApi.getFeedbackReport(submissionId);
      return report.timeline;
    },
    refetchInterval: (q) => (q.state.data?.length ? false : 1500)
  });

  const spans = useMemo(() => synthesize(timeline), [timeline]);
  const totalMs = useMemo(() => spans.reduce((a, s) => a + s.durationMs, 0), [spans]);
  const filteredSpans = useMemo(
    () => spans.filter((s) => activeKinds.has(s.kind)),
    [spans, activeKinds]
  );

  const selected = useMemo(
    () =>
      spans.find((s) => s.id === selectedId) ??
      filteredSpans[0] ??
      spans[0] ??
      null,
    [spans, filteredSpans, selectedId]
  );

  const toggleKind = (k: SpanKind) => {
    setActiveKinds((prev) => {
      const next = new Set(prev);
      if (next.has(k)) {
        next.delete(k);
      } else {
        next.add(k);
      }
      return next;
    });
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 1500);
    } catch {
      /* ignore */
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-6 pt-28 pb-20 text-center">
        <div className="inline-flex items-center space-x-2 text-gray-500">
          <Loader2 size={18} className="animate-spin" />
          <span>타임라인 준비 중…</span>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="max-w-2xl mx-auto px-6 pt-28 pb-20 text-center">
        <p className="text-gray-800 font-semibold mb-2">타임라인 정보를 불러올 수 없습니다.</p>
        <p className="text-sm text-gray-500 mb-5">리포트가 아직 생성 중이면 잠시 후 다시 확인해 주세요.</p>
        <Link
          href={withPrefix(`/submissions/${submissionId}/report`)}
          className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-colors"
        >
          <ArrowLeft size={14} />
          <span>리포트로 돌아가기</span>
        </Link>
      </div>
    );
  }

  if (!timeline.length) {
    return (
      <div className="max-w-2xl mx-auto px-6 pt-28 pb-20 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 mb-4">
          <Hash size={20} />
        </div>
        <p className="text-gray-800 font-semibold mb-2">표시할 Trace가 없습니다.</p>
        <p className="text-sm text-gray-500 mb-5">
          아직 리포트가 처리 중이거나 이 제출에 기록된 AI/도구 이벤트가 없습니다.
        </p>
        <Link
          href={withPrefix(`/submissions/${submissionId}/report`)}
          className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-semibold text-sm transition-colors"
        >
          <ArrowLeft size={14} />
          <span>리포트로 돌아가기</span>
        </Link>
      </div>
    );
  }

  const shortSub = submissionId.replace(/^submission-/, "").slice(0, 6);
  const totalSec = (totalMs / 1000).toFixed(1);

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-6 pt-28 pb-12">
        {/* ── Header strip ── */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
          {/* Left — breadcrumb + title */}
          <div>
            <Link
              href={withPrefix(`/submissions/${submissionId}/report`)}
              className="inline-flex items-center space-x-1.5 text-sm text-gray-500 hover:text-indigo-600 mb-2 transition-colors"
            >
              <ArrowLeft size={14} />
              <span>리포트로</span>
            </Link>
            <h1 className="text-3xl md:text-4xl font-display font-bold text-gray-900 tracking-tight leading-[1.1]">
              Trace 타임라인
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              제출 #{shortSub} · {spans.length} 스팬 · 총 {totalSec}초
            </p>
          </div>

          {/* Right — filter pills + collapse */}
          <div className="flex flex-wrap items-center gap-2">
            {(Object.keys(KIND_CONFIG) as SpanKind[]).map((k) => {
              const cfg = KIND_CONFIG[k];
              const Icon = cfg.icon;
              const active = activeKinds.has(k);
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => toggleKind(k)}
                  className={`inline-flex items-center gap-2 pl-3.5 pr-2.5 py-2 rounded-xl border-2 text-sm font-semibold transition-colors ${
                    active
                      ? `${cfg.tintSoft} ${cfg.text} border-transparent`
                      : "bg-white text-gray-400 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <Icon size={14} strokeWidth={2.2} />
                  <span>{cfg.label}</span>
                  <span
                    className={`inline-flex items-center justify-center w-4 h-4 rounded-full ${
                      active ? cfg.accent : "bg-gray-200"
                    } text-white`}
                  >
                    {active && <Check size={10} strokeWidth={3} />}
                  </span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 text-sm font-semibold transition-colors"
            >
              <ListCollapse size={14} strokeWidth={2.2} />
              <span>{collapsed ? "Expand all" : "Collapse all"}</span>
            </button>
          </div>
        </div>

        {/* ── Two-column body ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5">
          {/* ── LEFT: Span list ── */}
          <aside className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <span className="font-display font-bold text-gray-900">All Spans</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                {filteredSpans.length}
              </span>
            </div>
            <div className="max-h-[72vh] overflow-y-auto">
              {filteredSpans.map((s) => {
                const active = selected?.id === s.id;
                const cfg = KIND_CONFIG[s.kind];
                const Icon = cfg.icon;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedId(s.id)}
                    className={`relative w-full flex items-start gap-3 px-5 py-3 text-left border-b border-gray-50 last:border-b-0 transition-colors ${
                      active ? "bg-indigo-50/60" : "hover:bg-gray-50"
                    }`}
                  >
                    {active && (
                      <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-indigo-500" />
                    )}
                    <span
                      className={`shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-lg ${cfg.tint} ${cfg.text}`}
                    >
                      <Icon size={14} strokeWidth={2.4} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div
                        className={`text-sm font-semibold truncate ${
                          active ? "text-indigo-900" : "text-gray-900"
                        }`}
                      >
                        {s.name}
                      </div>
                      {!collapsed && (
                        <div className="text-xs text-gray-500 truncate mt-0.5">
                          {s.subLabel}
                        </div>
                      )}
                    </div>
                    <span className="shrink-0 text-[11px] font-mono text-gray-500 tabular-nums self-center">
                      {formatDuration(s.durationMs)}
                    </span>
                  </button>
                );
              })}
              {filteredSpans.length === 0 && (
                <div className="px-5 py-10 text-center text-sm text-gray-400">
                  필터 조건에 맞는 span이 없습니다.
                </div>
              )}
            </div>
          </aside>

          {/* ── RIGHT: Detail pane ── */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {selected ? (
              <DetailPane
                span={selected}
                tab={tab}
                setTab={setTab}
                allSpans={spans}
                totalMs={totalMs}
                onSpanClick={setSelectedId}
              />
            ) : (
              <div className="p-10 text-center text-sm text-gray-400">
                선택된 span이 없습니다.
              </div>
            )}
          </section>
        </div>

        {/* ── Bottom bar ── */}
        <div className="flex items-center justify-between mt-5 pt-5 border-t border-gray-200">
          <Link
            href={withPrefix(`/submissions/${submissionId}/report`)}
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 text-sm font-semibold transition-colors"
          >
            <ArrowLeft size={14} strokeWidth={2.2} />
            <span>리포트로</span>
          </Link>
          <button
            type="button"
            onClick={handleShare}
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl border-2 border-indigo-500 text-indigo-600 hover:bg-indigo-50 text-sm font-semibold transition-colors"
          >
            {copiedShare ? (
              <Check size={14} strokeWidth={2.4} className="text-green-600" />
            ) : (
              <Copy size={14} strokeWidth={2.2} />
            )}
            <span>{copiedShare ? "링크 복사됨" : "타임라인 공유"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── DetailPane ─── */

function DetailPane({
  span,
  tab,
  setTab,
  allSpans,
  totalMs,
  onSpanClick
}: {
  span: Span;
  tab: "input" | "output" | "logs";
  setTab: (t: "input" | "output" | "logs") => void;
  allSpans: Span[];
  totalMs: number;
  onSpanClick: (id: string) => void;
}) {
  const cfg = KIND_CONFIG[span.kind];
  const Icon = cfg.icon;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className={`shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-xl ${cfg.tint} ${cfg.text}`}
            >
              <Icon size={18} strokeWidth={2.4} />
            </span>
            <div className="min-w-0">
              <div className="font-display font-bold text-xl text-gray-900 truncate">
                <span className={cfg.text}>{cfg.label}</span>
                <span className="text-gray-400 mx-1.5">·</span>
                <span>{span.name}</span>
              </div>
            </div>
          </div>
          <StatusBadge code={span.status} />
        </div>

        {/* Meta strip */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-500">
          <MetaItem icon={Clock} label="Duration" value={formatDuration(span.durationMs)} />
          <MetaItem icon={Cpu} label="Model" value={span.model} />
          {span.kind === "llm" && (
            <MetaItem
              icon={Hash}
              label="Tokens"
              value={`${span.tokensIn.toLocaleString()} / ${span.tokensOut.toLocaleString()}`}
            />
          )}
          <MetaItem icon={CalendarClock} label="Started" value={span.time} />
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 flex items-center gap-6 border-b border-gray-100">
        {(["input", "output", "logs"] as const).map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`relative py-3 text-sm font-semibold capitalize transition-colors ${
                active ? "text-indigo-600" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t === "input" ? "Input" : t === "output" ? "Output" : "Logs"}
              {active && (
                <span className="absolute left-0 right-0 bottom-0 h-0.5 bg-indigo-500 rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="p-6 flex-1 min-h-0 overflow-auto">
        {tab === "input" && <InputTab span={span} />}
        {tab === "output" && <OutputTab span={span} />}
        {tab === "logs" && <LogsTab span={span} />}
      </div>

      {/* Mini gantt */}
      <div className="border-t border-gray-100 p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">
            Span timeline
          </span>
          <span className="text-xs text-gray-400 tabular-nums">
            ({(totalMs / 1000).toFixed(1)}s total)
          </span>
        </div>
        <GanttBar
          spans={allSpans}
          selectedId={span.id}
          totalMs={totalMs}
          onClick={onSpanClick}
        />
      </div>
    </div>
  );
}

/* ─── Tabs content ─── */

function InputTab({ span }: { span: Span }) {
  const rows: Array<[string, string]> = [
    ["span_id", `"${span.id}"`],
    ["parent_id", "null"],
    ["task", `"${span.task}"`],
    ["prompt_summary", `"${truncate(span.promptSummary, 120)}"`],
    ["kind", `"${KIND_CONFIG[span.kind].label}"`],
    ["model", `"${span.model}"`],
    ["started_at", `"${span.time}"`],
    ["duration_ms", String(span.durationMs)]
  ];
  return (
    <div className="rounded-xl border border-gray-100 overflow-hidden">
      <table className="w-full text-sm font-mono">
        <tbody>
          {rows.map(([k, v], i) => (
            <tr
              key={k}
              className={i % 2 === 0 ? "bg-gray-50" : "bg-white"}
            >
              <td className="px-4 py-2 w-[180px] text-gray-500 align-top">{k}</td>
              <td className="px-4 py-2 text-indigo-700 break-all">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OutputTab({ span }: { span: Span }) {
  return (
    <pre className="rounded-xl bg-gray-900 text-gray-100 p-5 text-[13px] font-mono leading-relaxed overflow-auto whitespace-pre-wrap">
      {JSON.stringify(span.outputJson, null, 2)}
    </pre>
  );
}

function LogsTab({ span }: { span: Span }) {
  return (
    <div className="space-y-2">
      {span.logs.map((log, i) => {
        const cfg = KIND_CONFIG[log.kind];
        return (
          <div
            key={i}
            className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 bg-white"
          >
            <span
              className="shrink-0 w-1 h-8 rounded-full"
              style={{ backgroundColor: cfg.dot }}
            />
            <span className="shrink-0 font-mono text-xs text-gray-500 tabular-nums pt-0.5 min-w-[68px]">
              {log.t}
            </span>
            <span className="text-sm text-gray-700 leading-relaxed">{log.msg}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Small atoms ─── */

function StatusBadge({ code }: { code: number }) {
  const ok = code >= 200 && code < 400;
  return (
    <span
      className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${
        ok ? "bg-green-100 text-green-700" : "bg-rose-100 text-rose-700"
      }`}
    >
      {code}
      {ok && <Check size={11} strokeWidth={3} />}
    </span>
  );
}

function MetaItem({
  icon: Icon,
  label,
  value
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon size={13} strokeWidth={2} className="text-gray-400" />
      <span className="text-gray-400">{label}</span>
      <span className="text-gray-700 font-semibold tabular-nums">{value}</span>
    </span>
  );
}

function GanttBar({
  spans,
  selectedId,
  totalMs,
  onClick
}: {
  spans: Span[];
  selectedId: string;
  totalMs: number;
  onClick: (id: string) => void;
}) {
  const totalSec = Math.max(1, Math.ceil(totalMs / 1000));
  return (
    <div>
      {/* Tick labels */}
      <div className="relative h-4 mb-1">
        {Array.from({ length: totalSec + 1 }).map((_, i) => {
          const pct = totalMs === 0 ? 0 : ((i * 1000) / totalMs) * 100;
          return (
            <span
              key={i}
              className="absolute top-0 text-[10px] text-gray-400 tabular-nums -translate-x-1/2"
              style={{ left: `${Math.min(100, Math.max(0, pct))}%` }}
            >
              {i}s
            </span>
          );
        })}
      </div>
      {/* Selected-span pill indicator */}
      <div className="relative h-7 mb-1">
        {spans.map((s) => {
          if (s.id !== selectedId) return null;
          const left = totalMs === 0 ? 0 : (s.startedMs / totalMs) * 100;
          const width = totalMs === 0 ? 0 : (s.durationMs / totalMs) * 100;
          return (
            <div
              key={s.id}
              className="absolute top-0 h-7 px-2 rounded-lg bg-indigo-600 text-white text-[11px] font-semibold flex items-center whitespace-nowrap shadow-sm"
              style={{
                left: `${left}%`,
                width: `${Math.max(width, 4)}%`,
                minWidth: "90px"
              }}
            >
              <span className="truncate">
                {s.name} ({formatDuration(s.durationMs)})
              </span>
            </div>
          );
        })}
      </div>
      {/* Gantt row */}
      <div className="relative h-6 bg-gray-50 rounded-lg border border-gray-100 overflow-hidden">
        {spans.map((s) => {
          const left = totalMs === 0 ? 0 : (s.startedMs / totalMs) * 100;
          const width = totalMs === 0 ? 0 : (s.durationMs / totalMs) * 100;
          const active = s.id === selectedId;
          const cfg = KIND_CONFIG[s.kind];
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onClick(s.id)}
              className={`absolute top-1 bottom-1 rounded-md transition-transform hover:scale-y-110 ${active ? "ring-2 ring-indigo-500" : ""}`}
              style={{
                left: `${left}%`,
                width: `${Math.max(width, 0.6)}%`,
                backgroundColor: cfg.dot,
                opacity: active ? 1 : 0.85
              }}
              aria-label={`${s.name} · ${formatDuration(s.durationMs)}`}
              title={`${s.name} · ${formatDuration(s.durationMs)}`}
            />
          );
        })}
      </div>
    </div>
  );
}

/* ─── utils ─── */

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1).replace(/\.0+$/, "")}s`;
}

function truncate(s: string, max: number) {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

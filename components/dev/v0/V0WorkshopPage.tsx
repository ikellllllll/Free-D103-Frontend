"use client";

import { useEffect, useMemo, useState } from "react";

import { useRouteScope } from "@/components/routing/RouteScopeProvider";
import type {
  WorkshopGenerateInput,
  WorkshopPromoteInput,
  WorkshopState,
  WorkshopVariantState
} from "@/lib/workshop/types";
import { useUiStore } from "@/store/uiStore";

const defaultForm: WorkshopGenerateInput = {
  targetPath: "/login",
  prompt:
    "로그인 화면을 더 업무툴답게 다듬어줘. 기능 흐름과 한국어 문구는 유지하고, A는 보수적으로, B는 더 강한 작업툴 느낌으로 정리해줘."
};

const emptyState: WorkshopState = {
  configured: false,
  status: "idle",
  currentJobId: null,
  currentPid: null,
  targetPath: "",
  prompt: "",
  runningStep: null,
  heartbeatAt: null,
  heartbeatLabel: null,
  error: null,
  selectedVariant: null,
  startedAt: null,
  updatedAt: new Date(0).toISOString(),
  lastPromotionAt: null,
  variants: [
    {
      id: "a",
      title: "A안",
      direction: "보수적으로 정돈한 버전",
      url: "https://preview-a.158.180.89.153.sslip.io",
      status: "idle",
      summary: null,
      error: null,
      updatedAt: null
    },
    {
      id: "b",
      title: "B안",
      direction: "업무툴 톤을 강화한 버전",
      url: "https://preview-b.158.180.89.153.sslip.io",
      status: "idle",
      summary: null,
      error: null,
      updatedAt: null
    }
  ]
};

const STATUS_LABEL: Record<WorkshopState["status"], string> = {
  idle: "대기",
  running: "진행 중",
  ready: "완료",
  failed: "실패",
  promoting: "반영 중"
};

const VARIANT_STATUS_LABEL: Record<WorkshopVariantState["status"], string> = {
  idle: "대기",
  queued: "대기열",
  running: "생성 중",
  ready: "완료",
  failed: "실패"
};

async function readJson<T>(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store"
  });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "요청 처리에 실패했습니다.");
  return data;
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}

function formatElapsed(startedAt: string | null) {
  if (!startedAt) return "0:00";
  const ms = Date.now() - new Date(startedAt).getTime();
  const total = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(total / 60));
  const ss = String(total % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function formatSecondsAgo(at: string | null) {
  if (!at) return "—";
  const ms = Date.now() - new Date(at).getTime();
  const sec = Math.max(0, Math.round(ms / 1000));
  if (sec < 60) return `${sec}s ago`;
  const m = Math.floor(sec / 60);
  return `${m}m${sec % 60 > 0 ? ` ${sec % 60}s` : ""} ago`;
}

function VariantCard({
  variant,
  isSelected,
  busy,
  onPromote
}: {
  variant: WorkshopVariantState;
  isSelected: boolean;
  busy: boolean;
  onPromote: (id: "a" | "b") => void;
}) {
  const isReady = variant.status === "ready";

  return (
    <article className={"ws-variant" + (isSelected ? " ws-variant--promoted" : "")}>
      <header className="ws-variant__head">
        <div className="ws-variant__id-row">
          <span className="ws-variant__id">{variant.id.toUpperCase()}</span>
          <span className={"ws-variant__badge ws-variant__badge--" + variant.status}>
            {VARIANT_STATUS_LABEL[variant.status]}
          </span>
          {isSelected ? <span className="ws-variant__promoted-chip">반영됨</span> : null}
        </div>
        <h2 className="ws-variant__title">{variant.title}</h2>
        <p className="ws-variant__direction">{variant.direction}</p>
        {variant.updatedAt ? (
          <span className="ws-variant__updated">{formatDateTime(variant.updatedAt)}</span>
        ) : null}
      </header>

      <div className="ws-variant__preview">
        {isReady ? (
          <iframe
            className="ws-variant__iframe"
            src={variant.url}
            title={`${variant.title} 미리보기`}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        ) : (
          <div className="ws-variant__placeholder">
            <span className="ws-variant__placeholder-state">
              {variant.status === "running" ? "생성 중..." : variant.status === "failed" ? "실패" : variant.status === "queued" ? "대기열" : "—"}
            </span>
            {variant.error ? <pre className="ws-variant__error">{variant.error}</pre> : null}
          </div>
        )}
      </div>

      <footer className="ws-variant__foot">
        <code className="ws-variant__url">{variant.url}</code>
        <div className="ws-variant__actions">
          <a className="ws-btn" href={variant.url} target="_blank" rel="noreferrer">열기 ↗</a>
          <button
            type="button"
            className="ws-btn ws-btn--primary"
            disabled={!isReady || busy}
            onClick={() => onPromote(variant.id)}
          >
            {variant.id.toUpperCase()}안 반영
          </button>
        </div>
      </footer>
    </article>
  );
}

export default function DevWorkshopPage() {
  const { withPrefix } = useRouteScope();
  const addToast = useUiStore((state) => state.addToast);
  const [form, setForm] = useState<WorkshopGenerateInput>(defaultForm);
  const [state, setState] = useState<WorkshopState>(emptyState);
  const [isBusySubmit, setIsBusySubmit] = useState(false);
  const [composerOpen, setComposerOpen] = useState(true);
  const [, setTick] = useState(0);

  const isBusy = state.status === "running" || state.status === "promoting";

  const liveTarget = useMemo(() => {
    if (!form.targetPath.trim()) return "#";
    return withPrefix(form.targetPath.startsWith("/") ? form.targetPath : `/${form.targetPath}`);
  }, [form.targetPath, withPrefix]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const next = await readJson<WorkshopState>("/api/workshop/status");
        if (cancelled) return;
        setState(next);
        setForm((c) => {
          if (c.targetPath.trim() || !next.targetPath) return c;
          return { ...c, targetPath: next.targetPath, prompt: next.prompt || c.prompt };
        });
      } catch { /* silent */ }
    };
    void load();
    return () => { cancelled = true; };
  }, [addToast]);

  useEffect(() => {
    if (!isBusy) return;
    const id = window.setInterval(async () => {
      try { const next = await readJson<WorkshopState>("/api/workshop/status"); setState(next); } catch { /* silent */ }
    }, 4000);
    return () => window.clearInterval(id);
  }, [isBusy]);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const handleGenerate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsBusySubmit(true);
    try {
      const next = await readJson<WorkshopState>("/api/workshop/generate", { method: "POST", body: JSON.stringify(form) });
      setState(next);
      addToast("A·B 시안 생성 시작", "success");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "생성 시작 실패", "error");
    } finally {
      setIsBusySubmit(false);
    }
  };

  const handlePromote = async (variant: "a" | "b") => {
    setIsBusySubmit(true);
    try {
      const payload: WorkshopPromoteInput = { variant };
      const next = await readJson<WorkshopState>("/api/workshop/promote", { method: "POST", body: JSON.stringify(payload) });
      setState(next);
      addToast(`${variant.toUpperCase()}안 반영 완료`, "success");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "반영 실패", "error");
    } finally {
      setIsBusySubmit(false);
    }
  };

  const variantA = state.variants.find((v) => v.id === "a");
  const variantB = state.variants.find((v) => v.id === "b");
  const statusKey: "running" | "ready" | "failed" | "idle" =
    state.status === "running" || state.status === "promoting" ? "running"
    : state.status === "ready" ? "ready"
    : state.status === "failed" ? "failed"
    : "idle";

  return (
    <div className="ws-page">
      {/* 헤더 */}
      <header className="ws-page-header">
        <div>
          <p className="ws-page-header__eyebrow">워크숍</p>
          <h1 className="ws-page-header__title">A/B 시안 비교</h1>
          <p className="ws-page-header__desc">동일한 프롬프트로 두 가지 방향의 시안을 생성하고 반영합니다.</p>
        </div>
        {state.targetPath ? (
          <div className={"ws-status-pill ws-status-pill--" + statusKey}>
            <span className="ws-status-pill__dot" />
            <span>{state.targetPath}</span>
            <span className="ws-status-pill__label">{STATUS_LABEL[state.status]}</span>
          </div>
        ) : null}
      </header>

      {/* 진행 표시 */}
      {isBusy ? (
        <div className="ws-activity">
          <span className="ws-activity__step">{state.runningStep ?? "진행 중"}</span>
          <div className="ws-activity__bar"><div className="ws-activity__bar-fill" /></div>
          <span className="ws-activity__meta">{formatElapsed(state.startedAt)} 경과 · {formatSecondsAgo(state.heartbeatAt)}</span>
        </div>
      ) : null}

      {/* 시안 패널 */}
      <div className="ws-stage">
        {variantA ? (
          <VariantCard variant={variantA} isSelected={state.selectedVariant === "a"} busy={isBusySubmit} onPromote={handlePromote} />
        ) : null}
        {variantB ? (
          <VariantCard variant={variantB} isSelected={state.selectedVariant === "b"} busy={isBusySubmit} onPromote={handlePromote} />
        ) : null}
      </div>

      {/* 새 비교 폼 */}
      <section className="ws-composer">
        <button type="button" className="ws-composer__toggle" onClick={() => setComposerOpen((v) => !v)}>
          <span className="ws-composer__toggle-arrow">{composerOpen ? "▾" : "▸"}</span>
          새 비교 생성
        </button>

        {composerOpen ? (
          <form className="ws-composer__form" onSubmit={handleGenerate}>
            <div className="ws-field">
              <label className="ws-field__label" htmlFor="ws-target">대상 경로</label>
              <input
                id="ws-target"
                className="ws-field__input"
                value={form.targetPath}
                onChange={(e) => setForm((c) => ({ ...c, targetPath: e.target.value }))}
                placeholder="/login"
                spellCheck={false}
              />
            </div>
            <div className="ws-field">
              <label className="ws-field__label" htmlFor="ws-prompt">프롬프트</label>
              <textarea
                id="ws-prompt"
                className="ws-field__textarea"
                value={form.prompt}
                onChange={(e) => setForm((c) => ({ ...c, prompt: e.target.value }))}
                rows={4}
              />
            </div>
            <div className="ws-composer__foot">
              {liveTarget !== "#" ? (
                <a href={liveTarget} target="_blank" rel="noreferrer" className="ws-composer__preview-link">
                  {liveTarget} ↗
                </a>
              ) : <span />}
              <button type="submit" className="ws-btn ws-btn--primary" disabled={isBusy || isBusySubmit}>
                {isBusy ? "진행 중..." : "실행"}
              </button>
            </div>
          </form>
        ) : null}
      </section>
    </div>
  );
}

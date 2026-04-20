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

const VARIANT_LABEL: Record<WorkshopVariantState["status"], string> = {
  idle: "대기",
  queued: "대기열",
  running: "진행 중",
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
  if (!response.ok) {
    throw new Error(data.error ?? "요청 처리에 실패했습니다.");
  }
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

function VariantPanel({
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
    <article
      className={
        "workshop-dev__variant" + (isSelected ? " workshop-dev__variant--selected" : "")
      }
    >
      <header className="workshop-dev__variant-head">
        <div className="workshop-dev__variant-tag">
          <span className="workshop-dev__variant-letter">{variant.id.toUpperCase()}</span>
          <span>{VARIANT_LABEL[variant.status]}</span>
          {isSelected ? (
            <span className="workshop-dev__variant-tag-promoted">· 반영됨</span>
          ) : null}
        </div>
        <h2 className="workshop-dev__variant-title">{variant.title}</h2>
        <p className="workshop-dev__variant-direction">{variant.direction}</p>
        {variant.updatedAt ? (
          <div className="workshop-dev__variant-meta">
            <span>{formatDateTime(variant.updatedAt)}</span>
          </div>
        ) : null}
      </header>

      <div className="workshop-dev__variant-body">
        {isReady ? (
          <iframe
            className="workshop-dev__variant-iframe"
            src={variant.url}
            title={`${variant.title} 미리보기`}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        ) : (
          <div className="workshop-dev__variant-placeholder">
            <div>
              <div className="workshop-dev__variant-placeholder-state">
                {variant.status === "running"
                  ? "생성 중"
                  : variant.status === "failed"
                    ? "실패"
                    : variant.status === "queued"
                      ? "대기열"
                      : "—"}
              </div>
              {variant.error ? (
                <pre>{variant.error}</pre>
              ) : variant.summary ? (
                <pre>{variant.summary}</pre>
              ) : null}
            </div>
          </div>
        )}
      </div>

      <footer className="workshop-dev__variant-actions">
        <code className="workshop-dev__variant-url">{variant.url}</code>
        <div className="workshop-dev__variant-buttons">
          <a
            className="workshop-dev__btn"
            href={variant.url}
            target="_blank"
            rel="noreferrer"
          >
            열기 ↗
          </a>
          <button
            type="button"
            className="workshop-dev__btn workshop-dev__btn--primary"
            disabled={!isReady || busy}
            onClick={() => onPromote(variant.id)}
          >
            {variant.id.toUpperCase()} 반영
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
    const load = async (silent = false) => {
      try {
        const next = await readJson<WorkshopState>("/api/workshop/status");
        if (cancelled) return;
        setState(next);
        setForm((c) => {
          if (c.targetPath.trim() || !next.targetPath) return c;
          return {
            ...c,
            targetPath: next.targetPath,
            prompt: next.prompt || c.prompt
          };
        });
      } catch (err) {
        if (silent || cancelled) return;
        const m = err instanceof Error ? err.message : "워크숍 상태 로드 실패";
        addToast(m, "error");
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [addToast]);

  useEffect(() => {
    if (!isBusy) return;
    const id = window.setInterval(async () => {
      try {
        const next = await readJson<WorkshopState>("/api/workshop/status");
        setState(next);
      } catch {
        /* silent during polling */
      }
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
      const next = await readJson<WorkshopState>("/api/workshop/generate", {
        method: "POST",
        body: JSON.stringify(form)
      });
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
      const next = await readJson<WorkshopState>("/api/workshop/promote", {
        method: "POST",
        body: JSON.stringify(payload)
      });
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
    state.status === "running" || state.status === "promoting"
      ? "running"
      : state.status === "ready"
        ? "ready"
        : state.status === "failed"
          ? "failed"
          : "idle";

  return (
    <div className="workshop-dev">
      {state.targetPath ? (
        <div className={`workshop-dev__statusline workshop-dev__statusline--${statusKey}`}>
          <span className="workshop-dev__status-dot" />
          <span className="workshop-dev__statusline-target">{state.targetPath}</span>
          <span className="workshop-dev__statusline-state">{STATUS_LABEL[state.status]}</span>
        </div>
      ) : null}

      <section className="workshop-dev__stage">
        {variantA ? (
          <VariantPanel
            variant={variantA}
            isSelected={state.selectedVariant === "a"}
            busy={isBusySubmit}
            onPromote={handlePromote}
          />
        ) : null}
        {variantB ? (
          <VariantPanel
            variant={variantB}
            isSelected={state.selectedVariant === "b"}
            busy={isBusySubmit}
            onPromote={handlePromote}
          />
        ) : null}
      </section>

      {isBusy ? (
        <div className="workshop-dev__activity">
          <span className="workshop-dev__activity-label">
            {state.runningStep ?? "진행 중"}
          </span>
          <div className="workshop-dev__activity-bar">
            <div className="workshop-dev__activity-bar-fill" />
          </div>
          <span className="workshop-dev__activity-meta">
            {formatElapsed(state.startedAt)} 경과 · 신호 {formatSecondsAgo(state.heartbeatAt)}
          </span>
        </div>
      ) : null}

      <form className="workshop-dev__composer" onSubmit={handleGenerate}>
        <button
          type="button"
          className="workshop-dev__composer-toggle"
          onClick={() => setComposerOpen((v) => !v)}
        >
          <span className="workshop-dev__composer-toggle-arrow">
            {composerOpen ? "▾" : "▸"}
          </span>
          새 비교
        </button>

        {composerOpen ? (
          <div className="workshop-dev__composer-fields">
            <div className="workshop-dev__composer-row">
              <label className="workshop-dev__composer-label" htmlFor="dev-target">
                target
              </label>
              <input
                id="dev-target"
                className="workshop-dev__composer-input"
                value={form.targetPath}
                onChange={(e) =>
                  setForm((c) => ({ ...c, targetPath: e.target.value }))
                }
                placeholder="/login"
                spellCheck={false}
              />
            </div>
            <div className="workshop-dev__composer-row">
              <label className="workshop-dev__composer-label" htmlFor="dev-prompt">
                prompt
              </label>
              <textarea
                id="dev-prompt"
                className="workshop-dev__composer-textarea"
                value={form.prompt}
                onChange={(e) =>
                  setForm((c) => ({ ...c, prompt: e.target.value }))
                }
                rows={3}
              />
            </div>
            <div className="workshop-dev__composer-actions">
              <span className="workshop-dev__composer-target">
                {liveTarget !== "#" ? (
                  <a href={liveTarget} target="_blank" rel="noreferrer">
                    {liveTarget}
                  </a>
                ) : null}
              </span>
              <button
                type="submit"
                className="workshop-dev__btn workshop-dev__btn--primary"
                disabled={isBusy || isBusySubmit}
              >
                실행
              </button>
            </div>
          </div>
        ) : null}
      </form>
    </div>
  );
}

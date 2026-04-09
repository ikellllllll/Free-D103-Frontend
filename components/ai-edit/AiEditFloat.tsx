"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import type { AiEditQueueItem, AiEditStartInput, AiEditState } from "@/lib/ai-edit/types";
import { useUiStore } from "@/store/uiStore";

const POLL_INTERVAL_MS = 3500;

const emptyState: AiEditState = {
  configured: false,
  status: "idle",
  jobId: null,
  pid: null,
  prompt: "",
  targetPath: "",
  currentStep: null,
  heartbeatAt: null,
  heartbeatLabel: null,
  thinking: null,
  error: null,
  startedAt: null,
  completedAt: null,
  updatedAt: new Date(0).toISOString(),
  queue: []
};

async function fetchJson<T>(input: RequestInfo, init?: RequestInit) {
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

function SparkIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M10 2L11.8 7.8H17.8L12.9 11.4L14.7 17.2L10 13.6L5.3 17.2L7.1 11.4L2.2 7.8H8.2L10 2Z"
        fill="currentColor"
      />
    </svg>
  );
}

function CloseIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function Spinner({ size = 14 }: { size?: number }) {
  return (
    <svg className="ai-edit-spinner" width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.3" />
      <path d="M7 1.5A5.5 5.5 0 0 1 12.5 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function formatHeartbeat(iso: string | null) {
  if (!iso) return null;
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return null;

  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(value);
}

export function AiEditFloat() {
  const pathname = usePathname();
  const addToast = useUiStore((state) => state.addToast);

  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [state, setState] = useState<AiEditState>(emptyState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showThinking, setShowThinking] = useState(false);
  const [myQueuedJobId, setMyQueuedJobId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const isRunning = state.status === "running";
  const isBusy = isRunning || isSubmitting;

  useEffect(() => {
    void fetchJson<AiEditState>("/api/ai-edit/status").then(setState).catch(() => null);
  }, []);

  const myQueuePosition = myQueuedJobId
    ? state.queue.findIndex((item: AiEditQueueItem) => item.jobId === myQueuedJobId) + 1
    : 0;

  const shouldPoll = state.status === "running" || state.queue.length > 0 || myQueuePosition > 0;

  useEffect(() => {
    if (!shouldPoll) return;

    const id = window.setInterval(() => {
      void fetchJson<AiEditState>("/api/ai-edit/status")
        .then((next) => {
          setState(next);

          if (myQueuedJobId && next.queue.every((item) => item.jobId !== myQueuedJobId)) {
            setMyQueuedJobId(null);
          }

          if (next.status === "done") {
            addToast("AI 수정이 완료되었습니다. 화면을 확인해 주세요.", "success");
          } else if (next.status === "failed") {
            addToast(next.error ?? "AI 수정 작업이 실패했습니다.", "error");
          }
        })
        .catch(() => null);
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(id);
  }, [addToast, myQueuedJobId, shouldPoll]);

  useEffect(() => {
    if (isOpen) {
      window.setTimeout(() => textareaRef.current?.focus(), 60);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handler = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed || isBusy) return;

    setIsSubmitting(true);

    try {
      const input: AiEditStartInput = { prompt: trimmed, targetPath: pathname };
      const next = await fetchJson<AiEditState>("/api/ai-edit", {
        method: "POST",
        body: JSON.stringify(input)
      });

      setState(next);
      setPrompt("");
      setShowThinking(false);

      const lastQueued = next.queue[next.queue.length - 1];
      if (lastQueued) {
        setMyQueuedJobId(lastQueued.jobId);
        addToast(`대기열에 추가되었습니다. (${next.queue.length}번째)`, "info");
      } else {
        setMyQueuedJobId(null);
        addToast("AI 수정 작업을 시작했습니다.", "info");
      }
    } catch (error) {
      addToast(error instanceof Error ? error.message : "AI 수정 작업을 시작하지 못했습니다.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  const statusClass =
    state.status === "running"
      ? "ai-edit-float__status ai-edit-float__status--running"
      : state.status === "done"
        ? "ai-edit-float__status ai-edit-float__status--done"
        : state.status === "failed"
          ? "ai-edit-float__status ai-edit-float__status--failed"
          : null;

  const statusLabel =
    state.status === "running"
      ? (state.currentStep ?? "작업 중입니다.")
      : state.status === "done"
        ? (state.currentStep ?? "작업이 완료되었습니다.")
        : state.status === "failed"
          ? (state.error ?? "오류가 발생했습니다.")
          : null;

  const heartbeatLabel = isRunning
    ? [state.heartbeatLabel, formatHeartbeat(state.heartbeatAt)].filter(Boolean).join(" · ")
    : null;

  return (
    <div className="ai-edit-float" ref={panelRef}>
      <button
        className={`ai-edit-float__trigger${isRunning ? " ai-edit-float__trigger--busy" : ""}`}
        onClick={() => setIsOpen((value) => !value)}
        aria-label={isOpen ? "AI 수정 닫기" : "AI 수정 열기"}
        title="AI로 UI 수정"
      >
        {isRunning ? <Spinner size={18} /> : <SparkIcon size={18} />}
      </button>

      {isOpen && (
        <div className="ai-edit-float__panel" role="dialog" aria-label="AI UI 수정">
          <div className="ai-edit-float__header">
            <div className="ai-edit-float__header-left">
              <SparkIcon size={13} />
              <span>AI UI 수정</span>
            </div>
            <button className="ai-edit-float__close" onClick={() => setIsOpen(false)} aria-label="닫기">
              <CloseIcon size={13} />
            </button>
          </div>

          <div className="ai-edit-float__path">
            <span className="ai-edit-float__path-label">현재 페이지</span>
            <code className="ai-edit-float__path-value">{pathname}</code>
          </div>

          {statusClass && statusLabel && (
            <div className={statusClass}>
              {isRunning && <Spinner size={12} />}
              <span>{statusLabel}</span>
            </div>
          )}

          {heartbeatLabel && (
            <div className="ai-edit-float__meta">
              <span>상태 갱신</span>
              <strong>{heartbeatLabel}</strong>
            </div>
          )}

          {isRunning && state.prompt && (
            <div className="ai-edit-float__current-prompt">
              <span className="ai-edit-float__current-prompt-label">요청 내용</span>
              <span className="ai-edit-float__current-prompt-text">{state.prompt}</span>
            </div>
          )}

          {myQueuePosition > 0 && (
            <div className="ai-edit-float__queue">
              <Spinner size={12} />
              <span>{myQueuePosition}번째 대기 중</span>
              {state.queue.length > 1 && (
                <span className="ai-edit-float__queue-total">전체 {state.queue.length}개</span>
              )}
            </div>
          )}

          {!myQueuePosition && state.queue.length > 0 && (
            <div className="ai-edit-float__queue-list">
              <div className="ai-edit-float__queue-list-head">
                <Spinner size={11} />
                <span>대기 중 {state.queue.length}개</span>
              </div>
              {state.queue.map((item, index) => (
                <div key={item.jobId} className="ai-edit-float__queue-item">
                  <span className="ai-edit-float__queue-item-num">{index + 1}</span>
                  <span className="ai-edit-float__queue-item-text">{item.prompt}</span>
                </div>
              ))}
            </div>
          )}

          {state.thinking && (
            <div className="ai-edit-float__thinking-wrap">
              <button
                className="ai-edit-float__thinking-toggle"
                onClick={() => setShowThinking((value) => !value)}
                type="button"
              >
                <svg
                  className={`ai-edit-float__thinking-chevron${showThinking ? " ai-edit-float__thinking-chevron--open" : ""}`}
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  aria-hidden
                >
                  <path
                    d="M3 4.5L6 7.5L9 4.5"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>AI 사고 과정</span>
                <span className="ai-edit-float__thinking-badge">thinking</span>
              </button>
              {showThinking && <pre className="ai-edit-float__thinking-body">{state.thinking}</pre>}
            </div>
          )}

          <form className="ai-edit-float__form" onSubmit={handleSubmit}>
            <textarea
              ref={textareaRef}
              className="ai-edit-float__textarea"
              placeholder={
                "수정 요청을 입력해 주세요.\n예) 로그인/회원가입 탭 전환에 애니메이션을 추가해서 더 부드럽게 넘어가게 해줘"
              }
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isBusy}
              rows={4}
            />
            <div className="ai-edit-float__footer">
              {!state.configured && <span className="ai-edit-float__warn">서버 설정이 연결되지 않았습니다.</span>}
              <span className="ai-edit-float__hint">Ctrl/Cmd + Enter 전송</span>
              <button
                className="button button--primary ai-edit-float__send"
                type="submit"
                disabled={isBusy || !prompt.trim() || !state.configured}
              >
                {isBusy ? "작업 중..." : "수정 요청"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

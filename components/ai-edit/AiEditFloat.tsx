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
  if (!response.ok) throw new Error(data.error ?? "요청 처리에 실패했습니다.");
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

export function AiEditFloat() {
  const pathname = usePathname();
  const addToast = useUiStore((state) => state.addToast);

  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [state, setState] = useState<AiEditState>(emptyState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showThinking, setShowThinking] = useState(false);
  // 내가 방금 큐에 넣은 jobId 추적 (대기 순번 표시용)
  const [myQueuedJobId, setMyQueuedJobId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const isRunning = state.status === "running";
  const isBusy = isRunning || isSubmitting;

  // 초기 상태 로드
  useEffect(() => {
    void fetchJson<AiEditState>("/api/ai-edit/status").then(setState).catch(() => null);
  }, []);

  // 큐에 내 작업이 있는지 확인하고 순번 반환
  const myQueuePosition = myQueuedJobId
    ? state.queue.findIndex((item: AiEditQueueItem) => item.jobId === myQueuedJobId) + 1
    : 0;

  // 실행 중이거나 큐에 내 항목 있으면 폴링
  const shouldPoll = isRunning || myQueuePosition > 0;

  useEffect(() => {
    if (!shouldPoll) return;

    const id = window.setInterval(() => {
      void fetchJson<AiEditState>("/api/ai-edit/status")
        .then((next) => {
          setState(next);

          // 내 큐 항목이 없어졌으면 실행 중이거나 완료된 것
          if (myQueuedJobId && next.queue.every((item: AiEditQueueItem) => item.jobId !== myQueuedJobId)) {
            setMyQueuedJobId(null);
          }

          if (next.status === "done") {
            addToast("UI 수정이 완료되었습니다. 화면을 확인해 주세요.", "success");
          } else if (next.status === "failed") {
            addToast(next.error ?? "수정 작업에 실패했습니다.", "error");
          }
        })
        .catch(() => null);
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(id);
  }, [shouldPoll, myQueuedJobId, addToast]);

  // 패널 열릴 때 textarea 포커스
  useEffect(() => {
    if (isOpen) window.setTimeout(() => textareaRef.current?.focus(), 60);
  }, [isOpen]);

  // 패널 외부 클릭 닫기
  useEffect(() => {
    if (!isOpen) return;

    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
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

      // 큐에 들어갔는지 확인 (상태가 여전히 running이고 queue 마지막 항목이 내 것)
      const lastQueued = next.queue[next.queue.length - 1] as AiEditQueueItem | undefined;
      if (lastQueued) {
        setMyQueuedJobId(lastQueued.jobId);
        addToast(`대기열에 추가됐습니다. (${next.queue.length}번째)`, "info");
      } else {
        setMyQueuedJobId(null);
        addToast("AI 에디팅 작업을 시작했습니다.", "info");
      }
    } catch (error) {
      addToast(error instanceof Error ? error.message : "작업을 시작하지 못했습니다.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      e.currentTarget.form?.requestSubmit();
    }
  };

  const statusClass =
    state.status === "running" ? "ai-edit-float__status ai-edit-float__status--running"
    : state.status === "done"  ? "ai-edit-float__status ai-edit-float__status--done"
    : state.status === "failed" ? "ai-edit-float__status ai-edit-float__status--failed"
    : null;

  const statusLabel =
    state.status === "running" ? (state.currentStep ?? "작업 중...")
    : state.status === "done"  ? (state.currentStep ?? "완료되었습니다.")
    : state.status === "failed" ? (state.error ?? "오류가 발생했습니다.")
    : null;

  return (
    <div className="ai-edit-float" ref={panelRef}>
      {/* 플로팅 버튼 */}
      <button
        className={`ai-edit-float__trigger${isRunning ? " ai-edit-float__trigger--busy" : ""}`}
        onClick={() => setIsOpen((v) => !v)}
        aria-label={isOpen ? "AI 편집 닫기" : "AI 편집 열기"}
        title="AI로 UI 수정"
      >
        {isRunning ? <Spinner size={18} /> : <SparkIcon size={18} />}
      </button>

      {/* 채팅 패널 */}
      {isOpen && (
        <div className="ai-edit-float__panel" role="dialog" aria-label="AI UI 에디터">
          {/* 헤더 */}
          <div className="ai-edit-float__header">
            <div className="ai-edit-float__header-left">
              <SparkIcon size={13} />
              <span>AI UI 에디터</span>
            </div>
            <button className="ai-edit-float__close" onClick={() => setIsOpen(false)} aria-label="닫기">
              <CloseIcon size={13} />
            </button>
          </div>

          {/* 현재 페이지 경로 */}
          <div className="ai-edit-float__path">
            <span className="ai-edit-float__path-label">현재 페이지</span>
            <code className="ai-edit-float__path-value">{pathname}</code>
          </div>

          {/* 작업 상태 */}
          {statusClass && statusLabel && (
            <div className={statusClass}>
              {isRunning && <Spinner size={12} />}
              <span>{statusLabel}</span>
            </div>
          )}

          {/* 대기열 상태 */}
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
            <div className="ai-edit-float__queue ai-edit-float__queue--idle">
              <span>대기 중 {state.queue.length}개</span>
            </div>
          )}

          {/* 추론 과정 (thinking) */}
          {state.thinking && (
            <div className="ai-edit-float__thinking-wrap">
              <button
                className="ai-edit-float__thinking-toggle"
                onClick={() => setShowThinking((v) => !v)}
                type="button"
              >
                <svg
                  className={`ai-edit-float__thinking-chevron${showThinking ? " ai-edit-float__thinking-chevron--open" : ""}`}
                  width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden
                >
                  <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>AI 추론 과정</span>
                <span className="ai-edit-float__thinking-badge">thinking</span>
              </button>
              {showThinking && (
                <pre className="ai-edit-float__thinking-body">{state.thinking}</pre>
              )}
            </div>
          )}

          {/* 입력 폼 */}
          <form className="ai-edit-float__form" onSubmit={handleSubmit}>
            <textarea
              ref={textareaRef}
              className="ai-edit-float__textarea"
              placeholder={"수정 요청을 입력하세요.\n예: 로그인 버튼을 우측 상단으로 옮기고 더 눈에 띄게 만들어줘"}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isBusy}
              rows={4}
            />
            <div className="ai-edit-float__footer">
              {!state.configured && (
                <span className="ai-edit-float__warn">런타임 미연결</span>
              )}
              <span className="ai-edit-float__hint">⌘↵ 전송</span>
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

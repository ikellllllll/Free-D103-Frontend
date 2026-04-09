export {};

type AiEditStatus = "idle" | "running" | "done" | "failed";

interface AiEditQueueItem {
  jobId: string;
  prompt: string;
  targetPath: string;
  enqueuedAt: string;
}

interface AiEditState {
  configured: boolean;
  status: AiEditStatus;
  jobId: string | null;
  pid: number | null;
  prompt: string;
  targetPath: string;
  currentStep: string | null;
  heartbeatAt: string | null;
  heartbeatLabel: string | null;
  thinking: string | null;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
  queue: AiEditQueueItem[];
}

interface RuntimeConfig {
  baseUrl: string;
}

declare global {
  interface Window {
    __AIGDevtoolsConfig?: RuntimeConfig;
    __AIGDevtoolsOverlayLoaded?: boolean;
  }
}

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

const styles = `
  :host { all: initial; }
  * { box-sizing: border-box; }
  .aig-root {
    position: fixed;
    right: 24px;
    bottom: 24px;
    z-index: 2147483000;
    font-family: "IBM Plex Sans KR", system-ui, sans-serif;
    color: #ecf2ff;
  }
  .trigger {
    width: 56px;
    height: 56px;
    border: 1px solid rgba(121, 144, 255, 0.28);
    border-radius: 18px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background:
      radial-gradient(circle at top, rgba(125, 156, 255, 0.35), transparent 48%),
      linear-gradient(180deg, rgba(14, 18, 28, 0.96), rgba(21, 30, 48, 0.96));
    color: #eef3ff;
    cursor: pointer;
    box-shadow: 0 18px 42px rgba(5, 8, 14, 0.38);
    transition: transform 120ms ease, border-color 120ms ease;
  }
  .trigger:hover {
    transform: translateY(-1px);
    border-color: rgba(151, 170, 255, 0.42);
  }
  .trigger--busy { border-color: rgba(97, 210, 166, 0.38); }
  .panel {
    position: absolute;
    right: 0;
    bottom: 72px;
    width: min(360px, calc(100vw - 32px));
    border-radius: 22px;
    border: 1px solid rgba(132, 151, 199, 0.18);
    background:
      linear-gradient(180deg, rgba(12, 16, 24, 0.98), rgba(16, 23, 38, 0.98));
    box-shadow: 0 28px 70px rgba(0, 0, 0, 0.46);
    overflow: hidden;
  }
  .panel__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(255, 255, 255, 0.02);
  }
  .panel__title {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 0.9rem;
    font-weight: 700;
  }
  .icon-button {
    border: 0;
    width: 28px;
    height: 28px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.06);
    color: #dbe4ff;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }
  .body {
    display: grid;
    gap: 12px;
    padding: 16px;
  }
  .path, .meta, .status, .queue, .queue-list, .prompt-card, .thinking {
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.03);
  }
  .path, .meta, .prompt-card { padding: 12px 14px; }
  .path__label, .prompt-card__label, .footer__left {
    display: block;
    color: #8b97b5;
    font-size: 0.76rem;
  }
  .path__label, .prompt-card__label { margin-bottom: 6px; }
  .path code, .prompt-card__text, .queue-item__text {
    font-family: "JetBrains Mono", monospace;
    font-size: 0.83rem;
    line-height: 1.55;
  }
  .status {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 12px 14px;
    font-size: 0.84rem;
    line-height: 1.55;
  }
  .status--running {
    border-color: rgba(94, 132, 255, 0.28);
    background: rgba(94, 132, 255, 0.08);
  }
  .status--done {
    border-color: rgba(70, 194, 139, 0.28);
    background: rgba(70, 194, 139, 0.08);
  }
  .status--failed {
    border-color: rgba(255, 120, 120, 0.28);
    background: rgba(255, 120, 120, 0.08);
  }
  .meta {
    display: grid;
    gap: 4px;
    font-size: 0.8rem;
  }
  .meta strong { font-weight: 700; }
  .queue {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    font-size: 0.82rem;
  }
  .queue__total {
    margin-left: auto;
    color: #8b97b5;
  }
  .queue-list { overflow: hidden; }
  .queue-list__head {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 14px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    font-size: 0.82rem;
  }
  .queue-item {
    display: grid;
    grid-template-columns: 24px 1fr;
    gap: 10px;
    padding: 11px 14px;
    border-top: 1px solid rgba(255, 255, 255, 0.04);
    font-size: 0.8rem;
  }
  .queue-item:first-of-type { border-top: 0; }
  .queue-item__num { color: #8b97b5; }
  .thinking { overflow: hidden; }
  .thinking__toggle {
    width: 100%;
    border: 0;
    padding: 12px 14px;
    display: flex;
    align-items: center;
    gap: 8px;
    background: transparent;
    color: inherit;
    cursor: pointer;
    text-align: left;
  }
  .thinking__badge {
    margin-left: auto;
    padding: 2px 7px;
    border-radius: 999px;
    background: rgba(122, 146, 255, 0.14);
    color: #b8c6ff;
    font-size: 0.72rem;
    text-transform: uppercase;
  }
  .thinking__body {
    margin: 0;
    padding: 0 14px 14px;
    white-space: pre-wrap;
    font: 12px/1.65 "JetBrains Mono", monospace;
    color: #d7dff9;
  }
  .form {
    display: grid;
    gap: 12px;
  }
  .textarea {
    width: 100%;
    min-height: 116px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    background: rgba(5, 7, 12, 0.72);
    color: inherit;
    padding: 14px;
    resize: vertical;
    font: 0.9rem/1.65 "IBM Plex Sans KR", system-ui, sans-serif;
  }
  .textarea:disabled {
    opacity: 0.72;
    cursor: not-allowed;
  }
  .footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .footer__left {
    display: grid;
    gap: 3px;
  }
  .footer__warn { color: #ff9d9d; }
  .submit {
    border: 0;
    border-radius: 14px;
    padding: 11px 16px;
    background: linear-gradient(135deg, #4e6dff, #7e94ff);
    color: white;
    font-weight: 700;
    cursor: pointer;
  }
  .submit:disabled {
    opacity: 0.54;
    cursor: not-allowed;
  }
  .toast {
    position: absolute;
    right: 0;
    bottom: calc(100% + 12px);
    min-width: 220px;
    max-width: 300px;
    padding: 12px 14px;
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(9, 12, 18, 0.96);
    box-shadow: 0 18px 42px rgba(0, 0, 0, 0.34);
    font-size: 0.82rem;
    line-height: 1.55;
  }
  .toast--success { border-color: rgba(70, 194, 139, 0.32); }
  .toast--error { border-color: rgba(255, 120, 120, 0.32); }
  .toast--info { border-color: rgba(122, 146, 255, 0.32); }
  .spinner {
    width: 14px;
    height: 14px;
    border: 1.7px solid rgba(255, 255, 255, 0.28);
    border-top-color: currentColor;
    border-radius: 999px;
    animation: spin 0.8s linear infinite;
    flex: 0 0 auto;
  }
  .spark, .close {
    width: 18px;
    height: 18px;
    display: inline-block;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
`;

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const sparkIcon = `
  <svg class="spark" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M10 2 11.8 7.8H17.8L12.9 11.4 14.7 17.2 10 13.6 5.3 17.2 7.1 11.4 2.2 7.8H8.2L10 2Z" fill="currentColor" />
  </svg>
`;

const closeIcon = `
  <svg class="close" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M4 4 12 12M12 4 4 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
  </svg>
`;

const config = window.__AIGDevtoolsConfig;

if (!config || window.__AIGDevtoolsOverlayLoaded) {
  throw new Error("AIG devtools runtime is not configured.");
}

window.__AIGDevtoolsOverlayLoaded = true;

const root = document.createElement("div");
root.id = "aig-devtools-overlay-root";
document.body.appendChild(root);

const shadowRoot = root.attachShadow({ mode: "open" });

const uiState = {
  isOpen: false,
  isSubmitting: false,
  prompt: "",
  showThinking: false,
  myQueuedJobId: null as string | null,
  toast: null as null | { message: string; tone: "info" | "success" | "error" },
  toastTimer: 0
};

let serverState: AiEditState = { ...emptyState };

const runtimePath = (suffix: string) => `${config.baseUrl}${suffix}`;
const currentPath = () => window.location.pathname;

const formatHeartbeat = (iso: string | null) => {
  if (!iso) {
    return null;
  }
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(value);
};

const fetchJson = async <T>(input: string, init?: RequestInit) => {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    cache: "no-store"
  });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? "요청을 처리하지 못했습니다.");
  }
  return data;
};

const showToast = (message: string, tone: "info" | "success" | "error") => {
  uiState.toast = { message, tone };
  if (uiState.toastTimer) {
    window.clearTimeout(uiState.toastTimer);
  }
  uiState.toastTimer = window.setTimeout(() => {
    uiState.toast = null;
    render();
  }, 3200);
  render();
};

const shouldPoll = () => {
  const myQueuePosition = uiState.myQueuedJobId
    ? serverState.queue.findIndex((item) => item.jobId === uiState.myQueuedJobId) + 1
    : 0;
  return serverState.status === "running" || serverState.queue.length > 0 || myQueuePosition > 0;
};

const syncState = async (withOutcomeToast = false) => {
  try {
    const previousStatus = serverState.status;
    const next = await fetchJson<AiEditState>(runtimePath("/api/status"));
    serverState = next;
    if (uiState.myQueuedJobId && next.queue.every((item) => item.jobId !== uiState.myQueuedJobId)) {
      uiState.myQueuedJobId = null;
    }
    if (withOutcomeToast && previousStatus === "running" && next.status === "done") {
      showToast("AI 수정이 완료되었습니다. 화면을 확인해 주세요.", "success");
      return;
    }
    if (withOutcomeToast && previousStatus === "running" && next.status === "failed") {
      showToast(next.error ?? "AI 수정 작업이 실패했습니다.", "error");
      return;
    }
    render();
  } catch {
    render();
  }
};

const bindHistory = () => {
  const dispatch = () => window.dispatchEvent(new Event("aig-devtools:navigation"));
  const wrap = <T extends "pushState" | "replaceState">(method: T) => {
    const original = history[method];
    history[method] = function wrappedHistoryMethod(this: History, ...args: Parameters<History[T]>) {
      const result = original.apply(this, args);
      dispatch();
      return result;
    };
  };
  wrap("pushState");
  wrap("replaceState");
  window.addEventListener("popstate", dispatch);
};

const render = () => {
  const isRunning = serverState.status === "running";
  const isBusy = isRunning || uiState.isSubmitting;
  const myQueuePosition = uiState.myQueuedJobId
    ? serverState.queue.findIndex((item) => item.jobId === uiState.myQueuedJobId) + 1
    : 0;

  const statusClass =
    serverState.status === "running"
      ? "status status--running"
      : serverState.status === "done"
        ? "status status--done"
        : serverState.status === "failed"
          ? "status status--failed"
          : "";

  const statusLabel =
    serverState.status === "running"
      ? serverState.currentStep ?? "작업 중입니다."
      : serverState.status === "done"
        ? serverState.currentStep ?? "작업이 완료되었습니다."
        : serverState.status === "failed"
          ? serverState.error ?? "오류가 발생했습니다."
          : "";

  const heartbeat = isRunning
    ? [serverState.heartbeatLabel, formatHeartbeat(serverState.heartbeatAt)].filter(Boolean).join(" · ")
    : null;

  const queueList =
    !myQueuePosition && serverState.queue.length > 0
      ? `
        <div class="queue-list">
          <div class="queue-list__head">
            <span class="spinner" aria-hidden="true"></span>
            <span>대기 중 ${serverState.queue.length}건</span>
          </div>
          ${serverState.queue
            .map(
              (item, index) => `
                <div class="queue-item">
                  <span class="queue-item__num">${index + 1}</span>
                  <span class="queue-item__text">${escapeHtml(item.prompt)}</span>
                </div>
              `
            )
            .join("")}
        </div>
      `
      : "";

  shadowRoot.innerHTML = `
    <style>${styles}</style>
    <div class="aig-root">
      ${uiState.toast ? `<div class="toast toast--${uiState.toast.tone}">${escapeHtml(uiState.toast.message)}</div>` : ""}
      ${uiState.isOpen ? `
        <div class="panel" role="dialog" aria-label="AI UI 수정">
          <div class="panel__header">
            <div class="panel__title">${sparkIcon}<span>AI UI 수정</span></div>
            <button class="icon-button" type="button" data-action="close" aria-label="닫기">${closeIcon}</button>
          </div>
          <div class="body">
            <div class="path">
              <span class="path__label">현재 페이지</span>
              <code>${escapeHtml(currentPath())}</code>
            </div>
            ${statusClass && statusLabel ? `<div class="${statusClass}">${isRunning ? '<span class="spinner" aria-hidden="true"></span>' : ""}<span>${escapeHtml(statusLabel)}</span></div>` : ""}
            ${heartbeat ? `<div class="meta"><span>상태 갱신</span><strong>${escapeHtml(heartbeat)}</strong></div>` : ""}
            ${isRunning && serverState.prompt ? `<div class="prompt-card"><span class="prompt-card__label">요청 내용</span><div class="prompt-card__text">${escapeHtml(serverState.prompt)}</div></div>` : ""}
            ${myQueuePosition > 0 ? `<div class="queue"><span class="spinner" aria-hidden="true"></span><span>${myQueuePosition}번째 대기 중</span>${serverState.queue.length > 1 ? `<span class="queue__total">전체 ${serverState.queue.length}건</span>` : ""}</div>` : ""}
            ${queueList}
            ${serverState.thinking ? `
              <div class="thinking">
                <button class="thinking__toggle" type="button" data-action="toggle-thinking">
                  <span>${uiState.showThinking ? "▾" : "▸"}</span>
                  <span>AI 사고 과정</span>
                  <span class="thinking__badge">thinking</span>
                </button>
                ${uiState.showThinking ? `<pre class="thinking__body">${escapeHtml(serverState.thinking)}</pre>` : ""}
              </div>
            ` : ""}
            <form class="form" data-action="submit">
              <textarea class="textarea" rows="4" placeholder="수정 요청을 입력해 주세요.\n예: 로그인/회원가입 페이지 탭 전환을 부드럽게 만들고, 짧은 fade/slide 애니메이션을 추가해줘." ${isBusy ? "disabled" : ""}></textarea>
              <div class="footer">
                <div class="footer__left">
                  ${serverState.configured ? '<span>Ctrl/Cmd + Enter 전송</span>' : '<span class="footer__warn">서버 설정이 아직 연결되지 않았습니다.</span>'}
                  ${serverState.configured ? "" : '<span>sidecar와 OpenClaw, 배포 스크립트를 확인해 주세요.</span>'}
                </div>
                <button class="submit" type="submit" ${!serverState.configured || isBusy || !uiState.prompt.trim() ? "disabled" : ""}>${isBusy ? "작업 중..." : "수정 요청"}</button>
              </div>
            </form>
          </div>
        </div>
      ` : ""}
      <button class="trigger ${isRunning ? "trigger--busy" : ""}" type="button" data-action="toggle" aria-label="${uiState.isOpen ? "AI 수정 닫기" : "AI 수정 열기"}" title="AI로 현재 화면 수정">
        ${isRunning ? '<span class="spinner" aria-hidden="true"></span>' : sparkIcon}
      </button>
    </div>
  `;

  const promptField = shadowRoot.querySelector<HTMLTextAreaElement>(".textarea");
  if (promptField) {
    promptField.value = uiState.prompt;
  }

  shadowRoot.querySelector<HTMLElement>("[data-action='toggle']")?.addEventListener("click", () => {
    uiState.isOpen = !uiState.isOpen;
    render();
  });

  shadowRoot.querySelector<HTMLElement>("[data-action='close']")?.addEventListener("click", () => {
    uiState.isOpen = false;
    render();
  });

  promptField?.addEventListener("input", (event) => {
    uiState.prompt = (event.target as HTMLTextAreaElement).value;
    render();
  });

  promptField?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      (event.currentTarget as HTMLTextAreaElement).form?.requestSubmit();
    }
  });

  shadowRoot.querySelector<HTMLElement>("[data-action='toggle-thinking']")?.addEventListener("click", () => {
    uiState.showThinking = !uiState.showThinking;
    render();
  });

  shadowRoot.querySelector<HTMLFormElement>("[data-action='submit']")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const trimmed = uiState.prompt.trim();
    if (!trimmed || uiState.isSubmitting || isRunning) {
      return;
    }

    uiState.isSubmitting = true;
    render();

    try {
      const next = await fetchJson<AiEditState>(runtimePath("/api/edit"), {
        method: "POST",
        body: JSON.stringify({
          prompt: trimmed,
          targetPath: currentPath()
        })
      });

      serverState = next;
      uiState.prompt = "";
      uiState.showThinking = false;

      const lastQueued = next.queue[next.queue.length - 1];
      if (lastQueued) {
        uiState.myQueuedJobId = lastQueued.jobId;
        showToast(`대기열에 추가되었습니다. (${next.queue.length}번째)`, "info");
      } else {
        uiState.myQueuedJobId = null;
        showToast("AI 수정 작업을 시작했습니다.", "info");
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : "AI 수정 작업을 시작하지 못했습니다.", "error");
    } finally {
      uiState.isSubmitting = false;
      render();
    }
  });
};

document.addEventListener("mousedown", (event) => {
  if (!uiState.isOpen) {
    return;
  }
  if (root.contains(event.target as Node)) {
    return;
  }
  uiState.isOpen = false;
  render();
});

window.addEventListener("aig-devtools:navigation", () => {
  render();
});

bindHistory();
render();
void syncState(false);
window.setInterval(() => {
  if (document.visibilityState === "hidden" && !shouldPoll()) {
    return;
  }
  void syncState(true);
}, POLL_INTERVAL_MS);

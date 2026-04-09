export {};

type AiEditStatus = "idle" | "running" | "canceling" | "done" | "failed" | "canceled";
type AiEditMode = "edit" | "chat";
type AiEditMessageRole = "user" | "assistant" | "system";
type AiEditMessageStatus = "queued" | "running" | "done" | "failed" | "canceled";

interface AiEditQueueItem {
  jobId: string;
  prompt: string;
  targetPath: string;
  enqueuedAt: string;
  mode: AiEditMode;
}

interface AiEditMessage {
  id: string;
  jobId: string | null;
  role: AiEditMessageRole;
  mode: AiEditMode;
  text: string;
  createdAt: string;
  status: AiEditMessageStatus | null;
}

interface AiEditState {
  configured: boolean;
  status: AiEditStatus;
  jobId: string | null;
  pid: number | null;
  prompt: string;
  targetPath: string;
  mode: AiEditMode | null;
  currentStep: string | null;
  heartbeatAt: string | null;
  heartbeatLabel: string | null;
  thinking: string | null;
  activityLog: string[];
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
  queue: AiEditQueueItem[];
  messages: AiEditMessage[];
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
  mode: null,
  currentStep: null,
  heartbeatAt: null,
  heartbeatLabel: null,
  thinking: null,
  activityLog: [],
  error: null,
  startedAt: null,
  completedAt: null,
  updatedAt: new Date(0).toISOString(),
  queue: [],
  messages: []
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
    width: 58px;
    height: 58px;
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
    bottom: 74px;
    width: min(420px, calc(100vw - 32px));
    max-height: min(82vh, 860px);
    border-radius: 22px;
    border: 1px solid rgba(132, 151, 199, 0.18);
    background: linear-gradient(180deg, rgba(12, 16, 24, 0.98), rgba(16, 23, 38, 0.98));
    box-shadow: 0 28px 70px rgba(0, 0, 0, 0.46);
    overflow: hidden;
    display: grid;
    grid-template-rows: auto 1fr;
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
    grid-template-rows: auto auto minmax(0, 1fr) auto auto auto;
    gap: 12px;
    padding: 16px;
    min-height: 0;
  }
  .path, .status, .meta, .messages, .details, .composer {
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.03);
  }
  .path, .status, .meta, .composer { padding: 12px 14px; }
  .path__label, .composer__label {
    display: block;
    color: #8b97b5;
    font-size: 0.76rem;
    margin-bottom: 6px;
  }
  .path code {
    font-family: "JetBrains Mono", monospace;
    font-size: 0.83rem;
    line-height: 1.55;
  }
  .mode-switch {
    display: inline-grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
    padding: 4px;
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(255, 255, 255, 0.03);
  }
  .mode-switch__button {
    border: 0;
    border-radius: 12px;
    padding: 10px 12px;
    background: transparent;
    color: #9aa8ca;
    font-weight: 600;
    cursor: pointer;
  }
  .mode-switch__button--active {
    background: rgba(84, 111, 255, 0.2);
    color: #eef3ff;
  }
  .messages {
    min-height: 220px;
    max-height: 320px;
    overflow-y: auto;
    padding: 14px;
    display: grid;
    gap: 12px;
    align-content: start;
    align-items: start;
  }
  .messages--empty {
    display: grid;
    place-items: center;
    color: #8b97b5;
    font-size: 0.82rem;
    text-align: center;
    padding: 18px;
  }
  .message-row {
    display: flex;
    width: 100%;
  }
  .message-row--user {
    justify-content: flex-end;
  }
  .message-row--assistant,
  .message-row--system {
    justify-content: flex-start;
  }
  .message {
    display: grid;
    gap: 6px;
    padding: 10px 12px;
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(255, 255, 255, 0.02);
    width: fit-content;
    max-width: min(84%, 320px);
  }
  .message--user {
    background: rgba(84, 111, 255, 0.12);
    border-color: rgba(84, 111, 255, 0.2);
    border-bottom-right-radius: 6px;
  }
  .message--assistant {
    background: rgba(70, 194, 139, 0.08);
    border-color: rgba(70, 194, 139, 0.16);
    border-bottom-left-radius: 6px;
  }
  .message--system {
    background: rgba(255, 191, 84, 0.08);
    border-color: rgba(255, 191, 84, 0.16);
    border-bottom-left-radius: 6px;
  }
  .message--pending {
    border-style: dashed;
    background: rgba(255, 255, 255, 0.04);
  }
  .message__head {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    font-size: 0.75rem;
    color: #9aa8ca;
  }
  .message__name {
    font-weight: 700;
    color: #eef3ff;
  }
  .message__status {
    display: inline-flex;
    align-items: center;
    padding: 2px 7px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.05);
    color: #afbddf;
  }
  .message__time {
    margin-left: auto;
  }
  .message__body {
    white-space: pre-wrap;
    font-size: 0.84rem;
    line-height: 1.62;
    word-break: break-word;
  }
  .message__body--typing {
    display: inline-flex;
    align-items: center;
    gap: 10px;
  }
  .message__sub {
    color: #8b97b5;
    font-size: 0.75rem;
    line-height: 1.45;
  }
  .status {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    font-size: 0.84rem;
    line-height: 1.55;
  }
  .status--running, .status--canceling {
    border-color: rgba(94, 132, 255, 0.28);
    background: rgba(94, 132, 255, 0.08);
  }
  .status--done {
    border-color: rgba(70, 194, 139, 0.28);
    background: rgba(70, 194, 139, 0.08);
  }
  .status--failed, .status--canceled {
    border-color: rgba(255, 120, 120, 0.28);
    background: rgba(255, 120, 120, 0.08);
  }
  .meta {
    display: grid;
    gap: 4px;
    font-size: 0.8rem;
  }
  .meta strong { font-weight: 700; }
  .details {
    overflow: hidden;
  }
  .details__toggle {
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
  .details__badge {
    margin-left: auto;
    padding: 2px 7px;
    border-radius: 999px;
    background: rgba(122, 146, 255, 0.14);
    color: #b8c6ff;
    font-size: 0.72rem;
    text-transform: uppercase;
  }
  .details__body {
    margin: 0;
    padding: 0 14px 14px;
    white-space: pre-wrap;
    font: 12px/1.65 "JetBrains Mono", monospace;
    color: #d7dff9;
    max-height: 180px;
    overflow: auto;
  }
  .composer {
    display: grid;
    gap: 12px;
  }
  .textarea {
    width: 100%;
    min-height: 120px;
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
  .composer__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .composer__hint {
    display: grid;
    gap: 3px;
    color: #8b97b5;
    font-size: 0.76rem;
  }
  .composer__hint strong {
    color: #dbe4ff;
    font-size: 0.8rem;
  }
  .actions {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  .button {
    border: 0;
    border-radius: 14px;
    padding: 11px 16px;
    cursor: pointer;
    font-weight: 700;
  }
  .button--ghost {
    background: rgba(255, 255, 255, 0.06);
    color: #dbe4ff;
  }
  .button--danger {
    background: rgba(255, 120, 120, 0.16);
    color: #ffd8d8;
  }
  .button--primary {
    background: linear-gradient(135deg, #4e6dff, #7e94ff);
    color: white;
  }
  .button:disabled {
    opacity: 0.54;
    cursor: not-allowed;
  }
  .toast {
    position: absolute;
    right: 0;
    bottom: calc(100% + 12px);
    min-width: 220px;
    max-width: 320px;
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
  isCanceling: false,
  prompt: "",
  mode: "edit" as AiEditMode,
  showThinking: true,
  showLogs: true,
  lastSubmittedJobId: null as string | null,
  toast: null as null | { message: string; tone: "info" | "success" | "error" },
  toastTimer: 0
};

let serverState: AiEditState = { ...emptyState };

const runtimePath = (suffix: string) => `${config.baseUrl}${suffix}`;
const currentPath = () => window.location.pathname;

const formatTime = (iso: string | null) => {
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

const getTrackedQueuePosition = () => {
  if (!uiState.lastSubmittedJobId) {
    return 0;
  }
  return serverState.queue.findIndex((item) => item.jobId === uiState.lastSubmittedJobId) + 1;
};

const shouldPoll = () =>
  serverState.status === "running" ||
  serverState.status === "canceling" ||
  serverState.queue.length > 0 ||
  getTrackedQueuePosition() > 0;

const getStatusLabel = () => {
  if (serverState.status === "running" || serverState.status === "canceling") {
    return serverState.currentStep ?? "작업을 진행하고 있습니다.";
  }
  if (serverState.status === "done" && serverState.mode === "chat") {
    return "답변을 남겼습니다. 아래 대화 내용을 확인하세요.";
  }
  if (serverState.status === "done") {
    return serverState.currentStep ?? "작업을 완료했습니다.";
  }
  if (serverState.status === "failed") {
    return serverState.error ?? "작업 중 오류가 발생했습니다.";
  }
  if (serverState.status === "canceled") {
    return serverState.error ?? "작업이 취소되었습니다.";
  }
  return "";
};

const getPlaceholder = () =>
  uiState.mode === "edit"
    ? "예: 로그인/회원가입 탭 전환을 더 부드럽게 만들고, 현재 구조와 한국어 문구는 유지해줘."
    : "예: 이 화면이 왜 이렇게 동작하는지 설명해줘. 관련 파일도 같이 알려줘.";

const getComposerTitle = () => (uiState.mode === "edit" ? "수정 요청" : "질문 보내기");

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

const syncState = async (withOutcomeToast = false) => {
  try {
    const previousStatus = serverState.status;
    const previousJobId = serverState.jobId;
    const next = await fetchJson<AiEditState>(runtimePath("/api/status"));
    serverState = next;

    if (uiState.lastSubmittedJobId && next.queue.every((item) => item.jobId !== uiState.lastSubmittedJobId)) {
      if (next.jobId !== uiState.lastSubmittedJobId && next.status !== "running" && next.status !== "canceling") {
        uiState.lastSubmittedJobId = null;
      }
    }

    if (withOutcomeToast && previousJobId && previousStatus !== next.status && previousJobId === next.jobId) {
      if (next.status === "done") {
        showToast(next.mode === "chat" ? "답변을 받았습니다." : "수정 작업을 완료했습니다.", "success");
        return;
      }
      if (next.status === "failed") {
        showToast(next.error ?? "작업이 실패했습니다.", "error");
        return;
      }
      if (next.status === "canceled") {
        showToast("요청을 취소했습니다.", "info");
        return;
      }
    }

    render();
  } catch {
    render();
  }
};

const renderMessages = () => {
  const messages = serverState.messages.slice(-12);
  const showPendingChatBubble =
    serverState.mode === "chat" && (serverState.status === "running" || serverState.status === "canceling");

  if (messages.length === 0 && !showPendingChatBubble) {
    return `<div class="messages messages--empty">이 페이지에 대해 질문하거나, 수정 요청을 보내면 여기 대화가 쌓입니다.</div>`;
  }

  const pendingStatusLabel =
    serverState.status === "canceling" ? "취소 중" : serverState.status === "running" ? "답변 작성 중" : "";
  const pendingTime = formatTime(serverState.heartbeatAt) ?? formatTime(serverState.startedAt) ?? "";
  const pendingSub = [serverState.heartbeatLabel, pendingTime].filter(Boolean).join(" / ");

  return `
    <div class="messages">
      ${messages
        .map((message) => {
          const roleLabel =
            message.role === "assistant" ? "AIG" : message.role === "system" ? "시스템" : "나";
          const statusLabel = message.status
            ? {
                queued: "대기",
                running: "진행 중",
                done: "완료",
                failed: "실패",
                canceled: "취소"
              }[message.status]
            : "";

          return `
            <div class="message-row message-row--${message.role}">
              <article class="message message--${message.role}">
                <div class="message__head">
                  <span class="message__name">${escapeHtml(roleLabel)}</span>
                  ${statusLabel && statusLabel !== "완료" ? `<span class="message__status">${escapeHtml(statusLabel)}</span>` : ""}
                  <span class="message__time">${escapeHtml(formatTime(message.createdAt) ?? "")}</span>
                </div>
                <div class="message__body">${escapeHtml(message.text)}</div>
              </article>
            </div>
          `;
        })
        .join("")}
      ${
        showPendingChatBubble
          ? `
            <div class="message-row message-row--assistant">
              <article class="message message--assistant message--pending">
                <div class="message__head">
                  <span class="message__name">AIG</span>
                  ${pendingStatusLabel ? `<span class="message__status">${escapeHtml(pendingStatusLabel)}</span>` : ""}
                  ${pendingTime ? `<span class="message__time">${escapeHtml(pendingTime)}</span>` : ""}
                </div>
                <div class="message__body message__body--typing">
                  <span class="spinner" aria-hidden="true"></span>
                  <span>${escapeHtml(serverState.currentStep ?? "응답을 준비하는 중입니다.")}</span>
                </div>
                ${pendingSub ? `<div class="message__sub">${escapeHtml(pendingSub)}</div>` : ""}
              </article>
            </div>
          `
          : ""
      }
    </div>
  `;
};

const render = () => {
  const isWorking = serverState.status === "running" || serverState.status === "canceling";
  const isBusy = isWorking || uiState.isSubmitting || uiState.isCanceling;
  const queuePosition = getTrackedQueuePosition();
  const heartbeat = [serverState.heartbeatLabel, formatTime(serverState.heartbeatAt)].filter(Boolean).join(" / ");
  const activeMode = serverState.mode ?? uiState.mode;
  const isChatView = activeMode === "chat";
  const statusLabel = getStatusLabel();
  const showStatusCard = Boolean(statusLabel) && !isChatView;
  const canCancel = isWorking || queuePosition > 0;
  const logs = serverState.activityLog.slice(-20).join("\n");
  const modeMetaLabel = isWorking ? "현재 작업" : serverState.mode ? "최근 작업" : "";
  const showMetaCard = !isChatView && Boolean(heartbeat || modeMetaLabel || queuePosition > 0);

  const previousActive = shadowRoot.activeElement as HTMLElement | null;
  const shouldRestoreTextareaFocus = previousActive?.classList.contains("textarea") ?? false;
  const previousSelection =
    shouldRestoreTextareaFocus && previousActive instanceof HTMLTextAreaElement
      ? {
          start: previousActive.selectionStart,
          end: previousActive.selectionEnd
        }
      : null;

  shadowRoot.innerHTML = `
    <style>${styles}</style>
    <div class="aig-root">
      ${uiState.toast ? `<div class="toast toast--${uiState.toast.tone}">${escapeHtml(uiState.toast.message)}</div>` : ""}
      ${uiState.isOpen ? `
        <div class="panel" role="dialog" aria-label="AIG 개발 도구">
          <div class="panel__header">
            <div class="panel__title">${sparkIcon}<span>AIG 개발 도구</span></div>
            <button class="icon-button" type="button" data-action="close" aria-label="닫기">${closeIcon}</button>
          </div>
          <div class="body">
            <div class="path">
              <span class="path__label">현재 페이지</span>
              <code>${escapeHtml(currentPath())}</code>
            </div>
            <div class="mode-switch">
              <button class="mode-switch__button ${uiState.mode === "chat" ? "mode-switch__button--active" : ""}" type="button" data-action="mode-chat">대화</button>
              <button class="mode-switch__button ${uiState.mode === "edit" ? "mode-switch__button--active" : ""}" type="button" data-action="mode-edit">수정</button>
            </div>
            ${renderMessages()}
            ${showStatusCard ? `
              <div class="status status--${serverState.status}">
                ${(serverState.status === "running" || serverState.status === "canceling") ? '<span class="spinner" aria-hidden="true"></span>' : ""}
                <span>${escapeHtml(statusLabel)}</span>
              </div>
            ` : ""}
            ${showMetaCard ? `<div class="meta">${heartbeat ? `<span>상태 갱신</span><strong>${escapeHtml(heartbeat)}</strong>` : ""}${modeMetaLabel ? `<span>${modeMetaLabel}: ${serverState.mode === "chat" ? "대화" : "수정"}</span>` : ""}${queuePosition > 0 ? `<span>내 요청 대기 순서: ${queuePosition}번째</span>` : ""}</div>` : ""}
            ${serverState.thinking ? `
              <div class="details">
                <button class="details__toggle" type="button" data-action="toggle-thinking">
                  <span>${uiState.showThinking ? "▾" : "▸"}</span>
                  <span>실시간 Thinking</span>
                  <span class="details__badge">thinking</span>
                </button>
                ${uiState.showThinking ? `<pre class="details__body">${escapeHtml(serverState.thinking)}</pre>` : ""}
              </div>
            ` : ""}
            ${logs ? `
              <div class="details">
                <button class="details__toggle" type="button" data-action="toggle-logs">
                  <span>${uiState.showLogs ? "▾" : "▸"}</span>
                  <span>실시간 로그</span>
                  <span class="details__badge">tail</span>
                </button>
                ${uiState.showLogs ? `<pre class="details__body">${escapeHtml(logs)}</pre>` : ""}
              </div>
            ` : ""}
            <form class="composer" data-action="submit">
              <div>
                <span class="composer__label">${getComposerTitle()}</span>
                <textarea class="textarea" rows="4" placeholder="${escapeHtml(getPlaceholder())}" ${isBusy ? "disabled" : ""}></textarea>
              </div>
              <div class="composer__footer">
                <div class="composer__hint">
                  <strong>${activeMode === "chat" ? "설명/질문" : "실제 수정"}</strong>
                  <span>${serverState.configured ? "Ctrl/Cmd + Enter로 바로 전송" : "서버 설정이 아직 연결되지 않았습니다."}</span>
                </div>
                <div class="actions">
                  ${canCancel ? `<button class="button button--danger" type="button" data-action="cancel" ${uiState.isCanceling ? "disabled" : ""}>취소</button>` : ""}
                  <button class="button button--primary" type="submit" ${!serverState.configured || isBusy || !uiState.prompt.trim() ? "disabled" : ""}>
                    ${uiState.isSubmitting ? "전송 중..." : uiState.mode === "chat" ? "보내기" : "요청하기"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ` : ""}
      <button class="trigger ${isWorking ? "trigger--busy" : ""}" type="button" data-action="toggle" aria-label="${uiState.isOpen ? "AIG 개발 도구 닫기" : "AIG 개발 도구 열기"}" title="현재 화면에 대해 질문하거나 수정 요청">
        ${isWorking ? '<span class="spinner" aria-hidden="true"></span>' : sparkIcon}
      </button>
    </div>
  `;

  const promptField = shadowRoot.querySelector<HTMLTextAreaElement>(".textarea");
  const messagesPanel = shadowRoot.querySelector<HTMLElement>(".messages");
  if (promptField) {
    promptField.value = uiState.prompt;
    if (shouldRestoreTextareaFocus) {
      promptField.focus({ preventScroll: true });
      if (previousSelection) {
        promptField.setSelectionRange(previousSelection.start, previousSelection.end);
      }
    }
  }
  if (messagesPanel) {
    messagesPanel.scrollTop = messagesPanel.scrollHeight;
  }

  shadowRoot.querySelector<HTMLElement>("[data-action='toggle']")?.addEventListener("click", () => {
    uiState.isOpen = !uiState.isOpen;
    render();
  });

  shadowRoot.querySelector<HTMLElement>("[data-action='close']")?.addEventListener("click", () => {
    uiState.isOpen = false;
    render();
  });

  shadowRoot.querySelector<HTMLElement>("[data-action='mode-chat']")?.addEventListener("click", () => {
    uiState.mode = "chat";
    render();
  });

  shadowRoot.querySelector<HTMLElement>("[data-action='mode-edit']")?.addEventListener("click", () => {
    uiState.mode = "edit";
    render();
  });

  promptField?.addEventListener("input", (event) => {
    uiState.prompt = (event.target as HTMLTextAreaElement).value;
    const submit = shadowRoot.querySelector<HTMLButtonElement>(".button--primary");
    if (submit) {
      submit.disabled = !serverState.configured || isBusy || !uiState.prompt.trim();
    }
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

  shadowRoot.querySelector<HTMLElement>("[data-action='toggle-logs']")?.addEventListener("click", () => {
    uiState.showLogs = !uiState.showLogs;
    render();
  });

  shadowRoot.querySelector<HTMLElement>("[data-action='cancel']")?.addEventListener("click", async () => {
    if (uiState.isCanceling) {
      return;
    }

    uiState.isCanceling = true;
    render();

    try {
      const next = await fetchJson<AiEditState>(runtimePath("/api/cancel"), {
        method: "POST",
        body: JSON.stringify({
          jobId:
            (serverState.jobId && uiState.lastSubmittedJobId === serverState.jobId ? serverState.jobId : null) ??
            uiState.lastSubmittedJobId ??
            undefined
        })
      });
      serverState = next;
      showToast("취소 요청을 보냈습니다.", "info");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "취소 요청을 처리하지 못했습니다.", "error");
    } finally {
      uiState.isCanceling = false;
      render();
    }
  });

  shadowRoot.querySelector<HTMLFormElement>("[data-action='submit']")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const trimmed = uiState.prompt.trim();
    if (!trimmed || uiState.isSubmitting || isWorking) {
      return;
    }

    uiState.isSubmitting = true;
    render();

    try {
      const next = await fetchJson<AiEditState>(runtimePath("/api/edit"), {
        method: "POST",
        body: JSON.stringify({
          prompt: trimmed,
          targetPath: currentPath(),
          mode: uiState.mode
        })
      });

      serverState = next;
      uiState.prompt = "";

      const lastQueued = next.queue[next.queue.length - 1];
      uiState.lastSubmittedJobId = lastQueued?.jobId ?? next.jobId ?? null;

      if (lastQueued) {
        showToast(`대기열에 추가했습니다. (${next.queue.length}번째)`, "info");
      } else {
        showToast(uiState.mode === "chat" ? "질문을 보냈습니다." : "수정 요청을 시작했습니다.", "info");
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : "요청을 시작하지 못했습니다.", "error");
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

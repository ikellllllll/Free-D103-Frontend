"use client";

import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/common/Badge";
import { Card } from "@/components/common/Card";
import type {
  WorkshopGenerateInput,
  WorkshopPromoteInput,
  WorkshopState,
  WorkshopVariantState
} from "@/lib/workshop/types";
import { useUiStore } from "@/store/uiStore";

const statusToneMap = {
  idle: "neutral",
  running: "accent",
  ready: "green",
  failed: "red",
  promoting: "amber"
} as const;

const statusLabelMap = {
  idle: "대기",
  running: "생성 중",
  ready: "준비 완료",
  failed: "실패",
  promoting: "반영 중"
} as const;

const variantStatusToneMap = {
  idle: "neutral",
  queued: "neutral",
  running: "accent",
  ready: "green",
  failed: "red"
} as const;

const variantStatusLabelMap = {
  idle: "대기",
  queued: "대기열",
  running: "생성 중",
  ready: "확인 가능",
  failed: "실패"
} as const;

const workerHealthToneMap = {
  active: "green",
  quiet: "amber",
  stale: "red",
  idle: "neutral"
} as const;

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

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}

function formatDurationFromNow(value: string | null) {
  if (!value) {
    return "-";
  }

  const diffMs = Date.now() - new Date(value).getTime();
  const diffSeconds = Math.max(0, Math.round(diffMs / 1000));

  if (diffSeconds < 60) {
    return `${diffSeconds}초 전`;
  }

  const minutes = Math.floor(diffSeconds / 60);
  const seconds = diffSeconds % 60;
  return `${minutes}분 ${seconds}초 전`;
}

function getWorkerHealth(state: WorkshopState) {
  if (state.status !== "running" && state.status !== "promoting") {
    return {
      key: "idle" as const,
      label: "대기",
      detail: "현재 실행 중인 워커가 없습니다."
    };
  }

  if (!state.heartbeatAt) {
    return {
      key: "stale" as const,
      label: "신호 없음",
      detail: "아직 heartbeat를 받지 못했습니다."
    };
  }

  const ageMs = Date.now() - new Date(state.heartbeatAt).getTime();

  if (ageMs <= 15000) {
    return {
      key: "active" as const,
      label: "활성",
      detail: `${formatDurationFromNow(state.heartbeatAt)} heartbeat`
    };
  }

  if (ageMs <= 45000) {
    return {
      key: "quiet" as const,
      label: "느림",
      detail: `${formatDurationFromNow(state.heartbeatAt)} heartbeat`
    };
  }

  return {
    key: "stale" as const,
    label: "응답 없음",
    detail: `${formatDurationFromNow(state.heartbeatAt)} heartbeat`
  };
}

async function readJson<T>(input: RequestInfo, init?: RequestInit) {
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
    throw new Error(data.error ?? "요청 처리에 실패했습니다.");
  }

  return data;
}

function VariantCard({
  selectedVariant,
  variant,
  onPromote,
  promoting
}: {
  selectedVariant: WorkshopState["selectedVariant"];
  variant: WorkshopVariantState;
  onPromote: (variantId: "a" | "b") => void;
  promoting: boolean;
}) {
  const isReady = variant.status === "ready";
  const isSelected = selectedVariant === variant.id;

  return (
    <Card className={isSelected ? "variant-card variant-card--selected" : "variant-card"}>
      <div className="variant-card__head">
        <div className="stack-8">
          <div className="inline-heading">
            <strong>{variant.title}</strong>
            <Badge tone={variantStatusToneMap[variant.status]}>{variantStatusLabelMap[variant.status]}</Badge>
            {isSelected ? <Badge tone="teal">현재 반영</Badge> : null}
          </div>
          <p className="muted-copy">{variant.direction}</p>
        </div>

        <a className="button" href={variant.url} target="_blank" rel="noreferrer">
          미리보기
        </a>
      </div>

      <div className="variant-card__body">
        <span className="variant-card__meta">마지막 갱신 {formatDateTime(variant.updatedAt)}</span>
        <pre className="variant-card__summary">
          {variant.summary ?? variant.error ?? "아직 생성되지 않았습니다."}
        </pre>
      </div>

      <div className="variant-card__actions">
        <code>{variant.url}</code>
        <button
          className="button button--primary"
          disabled={!isReady || promoting}
          onClick={() => onPromote(variant.id)}
        >
          {promoting && isSelected ? "반영 중..." : `${variant.title} 반영`}
        </button>
      </div>
    </Card>
  );
}

export function WorkshopConsole() {
  const addToast = useUiStore((state) => state.addToast);
  const [form, setForm] = useState<WorkshopGenerateInput>(defaultForm);
  const [state, setState] = useState<WorkshopState>(emptyState);
  const [isBooting, setIsBooting] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isBusy = state.status === "running" || state.status === "promoting";
  const liveTarget = useMemo(() => {
    if (!form.targetPath.trim()) {
      return "#";
    }
    return form.targetPath.startsWith("/") ? form.targetPath : `/${form.targetPath}`;
  }, [form.targetPath]);
  const workerHealth = useMemo(() => getWorkerHealth(state), [state]);

  const loadStatus = async (silent = false) => {
    if (!silent) {
      setIsBooting(true);
    }

    try {
      const nextState = await readJson<WorkshopState>("/api/workshop/status");
      setState(nextState);

      if (!form.targetPath.trim() && nextState.targetPath) {
        setForm((current) => ({
          ...current,
          targetPath: nextState.targetPath,
          prompt: nextState.prompt || current.prompt
        }));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "워크숍 상태를 불러오지 못했습니다.";
      addToast(message, "error");
    } finally {
      setIsBooting(false);
    }
  };

  useEffect(() => {
    void loadStatus();
  }, []);

  useEffect(() => {
    if (!isBusy) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      void loadStatus(true);
    }, 4000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isBusy]);

  const handleGenerate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const nextState = await readJson<WorkshopState>("/api/workshop/generate", {
        method: "POST",
        body: JSON.stringify(form)
      });
      setState(nextState);
      addToast("A/B 시안 생성을 시작했습니다.", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "시안 생성을 시작하지 못했습니다.";
      addToast(message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePromote = async (variant: "a" | "b") => {
    setIsSubmitting(true);

    try {
      const payload: WorkshopPromoteInput = { variant };
      const nextState = await readJson<WorkshopState>("/api/workshop/promote", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      setState(nextState);
      addToast(`${variant.toUpperCase()}안을 본 서비스에 반영했습니다.`, "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "시안 반영에 실패했습니다.";
      addToast(message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="stack-24">
      <section className="hero-panel workshop-hero">
        <div className="hero-panel__copy">
          <span className="eyebrow">Preview Workshop</span>
          <h1>특정 페이지를 찍어서 2안 생성 후 바로 선택 반영</h1>
          <p>
            `페이지 경로 + 수정 요청`만 넣으면 A/B 두 버전을 만들고, 링크를 비교한 뒤 한 번에
            `studio.pyan.kr`에 반영하는 흐름입니다. 라이브 운영이 아니라 시안 제작과 와이어프레임
            검토에 맞춘 작업대입니다.
          </p>

          <div className="hero-flow">
            <div className="hero-flow__item">
              <span className="hero-flow__step">01</span>
              <div>
                <strong>대상 페이지와 요청 입력</strong>
                <small>`/login`, `/problems`, `/ide/1001` 같은 경로를 기준으로 작업합니다.</small>
              </div>
            </div>
            <div className="hero-flow__item">
              <span className="hero-flow__step">02</span>
              <div>
                <strong>A/B 시안 생성</strong>
                <small>보수안과 작업툴안 두 버전을 각각 preview 링크로 확인합니다.</small>
              </div>
            </div>
            <div className="hero-flow__item">
              <span className="hero-flow__step">03</span>
              <div>
                <strong>선택 즉시 본 서비스 반영</strong>
                <small>원하는 안 하나만 골라 현재 `studio.pyan.kr`에 올립니다.</small>
              </div>
            </div>
          </div>
        </div>

        <div className="stats-grid workshop-hero__stats">
          <div className="stat-card">
            <span className="stat-card__label">현재 상태</span>
            <strong>{statusLabelMap[state.status]}</strong>
            <small>{state.runningStep ?? "대기 중"}</small>
          </div>
          <div className="stat-card">
            <span className="stat-card__label">작업 경로</span>
            <strong>{state.targetPath || form.targetPath || "-"}</strong>
            <small>본 서비스 기준 대상 페이지</small>
          </div>
          <div className="stat-card">
            <span className="stat-card__label">워커 상태</span>
            <strong>{workerHealth.label}</strong>
            <small>{state.heartbeatLabel ? `${state.heartbeatLabel} · ${workerHealth.detail}` : workerHealth.detail}</small>
          </div>
        </div>
      </section>

      <div className="workshop-layout">
        <div className="workshop-console">
          <Card className="workshop-panel">
            <div className="section-head">
              <div className="stack-8">
                <h2>요청 입력</h2>
                <p className="muted-copy">
                  기능 흐름은 유지하고, 디자인과 정보 배치 위주로 수정하도록 요청하는 방식이 가장 안정적입니다.
                </p>
              </div>
              <Badge tone={statusToneMap[state.status]}>{statusLabelMap[state.status]}</Badge>
            </div>

            <form className="workshop-form" onSubmit={handleGenerate}>
              <div className="workshop-form__row">
                <label className="field">
                  <span>대상 페이지 경로</span>
                  <input
                    className="input"
                    placeholder="/login"
                    value={form.targetPath}
                    onChange={(event) => setForm((current) => ({ ...current, targetPath: event.target.value }))}
                  />
                </label>

                <a className="button" href={liveTarget} target="_blank" rel="noreferrer">
                  현재 페이지 열기
                </a>
              </div>

              <label className="field">
                <span>수정 요청</span>
                <textarea
                  className="input input--textarea"
                  placeholder="이 페이지를 업무툴 느낌으로 정리해줘. 한국어는 유지하고, 기능 흐름은 건드리지 마."
                  value={form.prompt}
                  onChange={(event) => setForm((current) => ({ ...current, prompt: event.target.value }))}
                />
              </label>

              <div className="workshop-form__actions">
                <div className="workshop-form__hint">
                  <small>보수안 + 작업툴안 두 버전만 생성합니다. 긴 작업이라 대개 10~20분 정도 걸립니다.</small>
                </div>

                <button className="button button--primary" type="submit" disabled={isBooting || isSubmitting || isBusy}>
                  {isBusy ? "작업 중..." : "A/B 시안 생성"}
                </button>
              </div>
            </form>
          </Card>

          <Card className="workshop-status">
            <div className="stack-8">
              <div className="inline-heading">
                <strong>실행 상태</strong>
                <Badge tone={statusToneMap[state.status]}>{statusLabelMap[state.status]}</Badge>
                <Badge tone={workerHealthToneMap[workerHealth.key]}>{workerHealth.label}</Badge>
              </div>
              <p className="muted-copy">
                {state.runningStep ?? "새 요청을 넣으면 A/B 두 시안을 순서대로 생성합니다."}
              </p>
            </div>

            <div className="workshop-status__grid">
              <div className="workshop-status__item">
                <span>현재 단계</span>
                <strong>{state.heartbeatLabel ?? "대기 중"}</strong>
              </div>
              <div className="workshop-status__item">
                <span>마지막 heartbeat</span>
                <strong>{formatDurationFromNow(state.heartbeatAt)}</strong>
              </div>
              <div className="workshop-status__item">
                <span>워커 PID</span>
                <strong>{state.currentPid ?? "-"}</strong>
              </div>
              <div className="workshop-status__item">
                <span>마지막 반영</span>
                <strong>{state.selectedVariant ? `${state.selectedVariant.toUpperCase()}안` : "-"}</strong>
              </div>
            </div>

            <div className="workshop-status__meta">
              <span>시작 {formatDateTime(state.startedAt)}</span>
              <span>갱신 {formatDateTime(state.updatedAt)}</span>
              <span>{workerHealth.detail}</span>
              <span>반영 {formatDateTime(state.lastPromotionAt)}</span>
            </div>
          </Card>

          {state.error ? (
            <Card className="workshop-alert workshop-alert--error">
              <strong>최근 오류</strong>
              <p>{state.error}</p>
            </Card>
          ) : null}

          <div className="variant-grid">
            {state.variants.map((variant) => (
              <VariantCard
                key={variant.id}
                selectedVariant={state.selectedVariant}
                variant={variant}
                promoting={isSubmitting || state.status === "promoting"}
                onPromote={handlePromote}
              />
            ))}
          </div>
        </div>

        <div className="workshop-sidebar">
          <Card className="workshop-panel">
            <div className="stack-12">
              <h2>고정 규칙</h2>
              <div className="step-list">
                <div className="step-card">
                  <strong>1. 경로를 먼저 지정</strong>
                  <small>`/login`, `/problems`, `/ide/1001`처럼 실제 라우트 기준으로 요청합니다.</small>
                </div>
                <div className="step-card">
                  <strong>2. 기능보다 화면 위주 요청</strong>
                  <small>“더 업무툴처럼”, “정보 밀도 높게”, “카드 대신 테이블”처럼 주는 편이 좋습니다.</small>
                </div>
                <div className="step-card">
                  <strong>3. 한 번에 하나의 작업만</strong>
                  <small>동시에 여러 요청을 돌리지 않고, 이전 작업이 끝난 뒤 다음 요청을 넣습니다.</small>
                </div>
              </div>
            </div>
          </Card>

          <Card className="workshop-panel">
            <div className="stack-12">
              <h2>추천 요청 예시</h2>
              <div className="workshop-example-list">
                <button
                  className="workshop-example"
                  onClick={() =>
                    setForm({
                      targetPath: "/login",
                      prompt:
                        "로그인 화면을 더 업무툴스럽게 정리해줘. 한국어 유지, 마케팅 느낌은 줄이고, A는 보수적으로, B는 운영 콘솔 느낌으로."
                    })
                  }
                >
                  로그인 화면을 업무툴 톤으로
                </button>
                <button
                  className="workshop-example"
                  onClick={() =>
                    setForm({
                      targetPath: "/problems",
                      prompt:
                        "과제 목록을 카드형보다 테이블 중심으로 바꿔줘. 정보 밀도를 높이고 필터와 상태 정보가 더 먼저 보이게 해줘."
                    })
                  }
                >
                  과제 목록을 테이블 중심으로
                </button>
                <button
                  className="workshop-example"
                  onClick={() =>
                    setForm({
                      targetPath: "/ide/1001",
                      prompt:
                        "IDE 화면에서 우측 AI 패널과 하단 패널의 정보 계층을 더 VSCode처럼 정리해줘. 기능 흐름은 유지하고 밀도만 다듬어줘."
                    })
                  }
                >
                  IDE 패널 구조를 더 VSCode처럼
                </button>
              </div>
            </div>
          </Card>

          <Card className="workshop-panel">
            <div className="stack-8">
              <h2>현재 상태</h2>
              <p className="muted-copy">
                {state.configured
                  ? "서버 런타임과 preview 슬롯이 연결된 상태입니다."
                  : "현재 환경에서는 서버 런타임이 연결되지 않아 실제 생성은 동작하지 않습니다."}
              </p>
              <code className="workshop-inline-code">studio.pyan.kr{state.targetPath || liveTarget}</code>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

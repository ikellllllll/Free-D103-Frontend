"use client";

import { useEffect, useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import {
  Sparkles,
  ArrowRight,
  Film,
  BookOpen,
  Lightbulb,
  Check,
  Play,
  SkipForward,
  Mail,
  Bookmark,
  Loader2,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  type LucideIcon
} from "lucide-react";

import type {
  WorkshopGenerateInput,
  WorkshopPromoteInput,
  WorkshopState,
  WorkshopVariantState
} from "@/lib/workshop/types";
import { useUiStore } from "@/store/uiStore";

type MilestoneState = "done" | "current" | "planned";

/* Shared tokens */
const SPRING = "transition-[transform,box-shadow,background-color,border-color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]";
const GLASS =
  "bg-white/70 backdrop-blur-md border border-white/70 ring-1 ring-inset ring-white/60 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9),0_1px_2px_rgba(17,24,39,0.04),0_10px_24px_-18px_rgba(79,70,229,0.3)]";

const defaultWorkshopForm: WorkshopGenerateInput = {
  targetPath: "/login",
  prompt:
    "로그인 화면을 더 업무툴답게 다듬어줘. 기능 흐름과 한국어 문구는 유지하고, A는 보수적으로, B는 더 강한 작업툴 느낌으로 정리해줘."
};

const emptyWorkshopState: WorkshopState = {
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

const WORKSHOP_STATUS_LABEL: Record<WorkshopState["status"], string> = {
  idle: "대기",
  running: "생성 중",
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

async function readWorkshopJson<T>(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store"
  });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? "워크샵 요청 처리에 실패했습니다.");
  }
  return data;
}

function formatWorkshopTime(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}

function formatWorkshopElapsed(value: string | null) {
  if (!value) return "0:00";
  const total = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export default function Dev2WorkshopPage() {
  const addToast = useUiStore((s) => s.addToast);
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [workshopForm, setWorkshopForm] = useState<WorkshopGenerateInput>(defaultWorkshopForm);
  const [workshopState, setWorkshopState] = useState<WorkshopState>(emptyWorkshopState);
  const [workshopBusy, setWorkshopBusy] = useState(false);
  const [, setTick] = useState(0);

  const isWorkshopBusy = workshopState.status === "running" || workshopState.status === "promoting";
  const variantA = workshopState.variants.find((variant) => variant.id === "a");
  const variantB = workshopState.variants.find((variant) => variant.id === "b");
  const readyCount = workshopState.variants.filter((variant) => variant.status === "ready").length;
  const currentPreviewUrl = useMemo(() => {
    const selected = workshopState.variants.find((variant) => variant.id === workshopState.selectedVariant);
    return selected?.url ?? variantA?.url ?? "#";
  }, [variantA?.url, workshopState.selectedVariant, workshopState.variants]);

  const loadWorkshopState = async (silent = false) => {
    try {
      const next = await readWorkshopJson<WorkshopState>("/api/workshop/status");
      setWorkshopState(next);
      setWorkshopForm((current) => {
        if (current.targetPath.trim() || !next.targetPath) return current;
        return { ...current, targetPath: next.targetPath, prompt: next.prompt || current.prompt };
      });
      if (!silent) {
        addToast("워크샵 상태를 새로고침했습니다.", "success");
      }
    } catch (error) {
      if (!silent) {
        addToast(error instanceof Error ? error.message : "워크샵 상태를 불러오지 못했습니다.", "error");
      }
    }
  };

  useEffect(() => {
    void loadWorkshopState(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isWorkshopBusy) return;
    const id = window.setInterval(() => {
      void loadWorkshopState(true);
    }, 4000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWorkshopBusy]);

  useEffect(() => {
    const id = window.setInterval(() => setTick((tick) => tick + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const handleSubscribe = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email.trim()) {
      addToast("이메일을 입력해 주세요.", "warning");
      return;
    }
    setSubscribed(true);
    setEmail("");
    addToast("사전 알림 구독이 완료되었습니다.", "success");
  };

  const handleGenerate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setWorkshopBusy(true);
    try {
      const next = await readWorkshopJson<WorkshopState>("/api/workshop/generate", {
        method: "POST",
        body: JSON.stringify(workshopForm)
      });
      setWorkshopState(next);
      addToast("A·B 시안 생성이 시작되었습니다.", "success");
    } catch (error) {
      addToast(error instanceof Error ? error.message : "워크샵 생성 시작 실패", "error");
    } finally {
      setWorkshopBusy(false);
    }
  };

  const handlePromote = async (variant: "a" | "b") => {
    setWorkshopBusy(true);
    try {
      const payload: WorkshopPromoteInput = { variant };
      const next = await readWorkshopJson<WorkshopState>("/api/workshop/promote", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      setWorkshopState(next);
      addToast(`${variant.toUpperCase()}안이 현재 화면에 반영되었습니다.`, "success");
    } catch (error) {
      addToast(error instanceof Error ? error.message : "시안 반영 실패", "error");
    } finally {
      setWorkshopBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50">
      {/* ── Aurora & Mesh backdrop ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Mesh gradient base */}
        <div
          className="absolute inset-0 opacity-90"
          style={{
            backgroundImage: `
              radial-gradient(1000px 700px at 8% -6%, rgba(99,102,241,0.22), transparent 60%),
              radial-gradient(900px 600px at 96% 4%, rgba(217,70,239,0.18), transparent 60%),
              radial-gradient(700px 500px at 50% 100%, rgba(56,189,248,0.16), transparent 65%)
            `
          }}
        />
        {/* Aurora blobs with staggered motion */}
        <div className="absolute -top-20 -left-24 w-[520px] h-[520px] rounded-full bg-indigo-400/25 blur-[120px] animate-blob-1" />
        <div className="absolute top-[6%] right-[-10rem] w-[520px] h-[520px] rounded-full bg-fuchsia-400/20 blur-[120px] animate-blob-2" />
        <div className="absolute top-[48%] left-[28%] w-[420px] h-[420px] rounded-full bg-violet-400/15 blur-[120px]" />
        {/* Faint grid */}
        <div className="absolute inset-0 bg-grid-pattern opacity-20" />
        {/* Bottom fade */}
        <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-b from-transparent to-slate-50" />
      </div>

      <div className="relative max-w-5xl mx-auto px-6 pt-24 sm:pt-28 pb-16">
        {/* ── HERO ── */}
        <section className="text-center animate-slide-up">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-display font-bold text-gray-900 tracking-tight leading-[1.05] mb-5 text-balance">
            공부가 아니라,
            <br />
            <span
              className="bg-gradient-animate"
              style={{
                backgroundImage: "linear-gradient(90deg, #4F46E5, #7C3AED, #D946EF, #4F46E5)",
                backgroundSize: "300% 100%",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                color: "transparent"
              }}
            >
              워크샵 같은 학습
            </span>
            <span className="text-gray-900">.</span>
          </h1>

          <p className="text-[15px] md:text-base text-gray-500 max-w-2xl mx-auto leading-relaxed mb-9">
            실무 시나리오를 직접 재연하며 프롬프트, Trace, 아키텍처 결정까지 되감기로 복습할 수 있도록 준비 중입니다.
          </p>

          <div className="flex items-center justify-center gap-3 flex-wrap">
            <a
              href="#subscribe"
              className={`group relative overflow-hidden inline-flex items-center justify-center gap-2 text-white font-semibold px-6 py-3 rounded-2xl ${SPRING} hover:-translate-y-0.5 active:scale-[0.97]`}
              style={{
                backgroundImage: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 50%, #D946EF 100%)",
                boxShadow:
                  "inset 0 1px 0 0 rgba(255,255,255,0.35), 0 1px 2px rgba(17,24,39,0.08), 0 14px 30px -12px rgba(124,58,237,0.55)"
              }}
            >
              <span
                className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{
                  backgroundImage: "linear-gradient(135deg, rgba(255,255,255,0.2), transparent 40%)"
                }}
              />
              <Mail size={16} strokeWidth={2.4} />
              <span className="relative">사전 알림 받기</span>
            </a>
            <a
              href="#roadmap"
              className={`inline-flex items-center justify-center gap-2 ${GLASS} text-gray-700 hover:text-indigo-700 hover:border-indigo-200 font-semibold px-6 py-3 rounded-2xl ${SPRING} hover:-translate-y-0.5 active:scale-[0.97]`}
            >
              <span>로드맵 보기</span>
              <ArrowRight size={14} strokeWidth={2.4} className="transition-transform duration-500 group-hover:translate-x-0.5" />
            </a>
          </div>
        </section>

        {/* ── 3D PREVIEW MOCKUP ── */}
        <section className="mt-16 mb-16 [perspective:1400px]">
          <div
            className="relative mx-auto max-w-4xl animate-slide-up"
            style={{ animationDelay: "0.08s", animationFillMode: "both" }}
          >
            {/* Ambient glow under the panel */}
            <div
              className="absolute -inset-x-10 -bottom-8 h-24 rounded-full blur-3xl opacity-70"
              style={{
                backgroundImage:
                  "radial-gradient(closest-side, rgba(124,58,237,0.45), transparent 70%)"
              }}
              aria-hidden="true"
            />
            <div
              className="relative rounded-3xl overflow-hidden"
              style={{
                backgroundColor: "#1E1B4B",
                transform: "rotateX(4deg)",
                transformOrigin: "50% 100%",
                boxShadow:
                  "0 1px 0 0 rgba(255,255,255,0.08) inset, 0 40px 80px -30px rgba(30,27,75,0.65), 0 24px 60px -24px rgba(124,58,237,0.5)"
              }}
            >
              <MockupPreview />
            </div>
          </div>
        </section>

        <WorkshopConsoleSection
          form={workshopForm}
          setForm={setWorkshopForm}
          state={workshopState}
          readyCount={readyCount}
          currentPreviewUrl={currentPreviewUrl}
          busy={workshopBusy || isWorkshopBusy}
          onRefresh={() => void loadWorkshopState()}
          onGenerate={handleGenerate}
          onPromote={handlePromote}
        />

        {/* ── FEATURE TEASER CARDS ── */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-16">
          <TeaserCard
            index="01"
            tag="in design"
            tagCls="bg-violet-100 text-violet-700"
            title="시나리오 리플레이"
            desc="과제 풀이를 step-by-step으로 되감기하고, 결정 포인트를 Figma처럼 코멘트할 수 있어요."
            progress={62}
            progressLabel="62% built"
            accent="from-indigo-500 to-violet-600"
            delay={0}
          />
          <TeaserCard
            index="02"
            tag="prototyping"
            tagCls="bg-teal-100 text-teal-700"
            title="프롬프트 라이브러리"
            desc="팀이 만든 프롬프트 블록을 조합해 나만의 에이전트 쉘을 짜고, 동료 것을 리믹스해요."
            progress={38}
            progressLabel="38% built"
            accent="from-teal-500 to-sky-500"
            delay={50}
          />
          <TeaserCard
            index="03"
            tag="concept"
            tagCls="bg-amber-100 text-amber-700"
            title="라이브 코치"
            desc="풀이 중 헷갈리는 구간에 멘토가 옆에서 짧은 힌트만 건네는 페어 모드."
            progress={12}
            progressLabel="12% concept"
            accent="from-amber-500 to-fuchsia-500"
            delay={100}
          />
        </section>

        {/* ── ROADMAP ── */}
        <section id="roadmap" className="mb-16">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.22em] text-gray-500 mb-5">
            2026 로드맵
          </h2>
          <Roadmap
            items={[
              { q: "Q1", title: "Core Architecture", state: "done" },
              { q: "Q2", title: "Workshop Preview", state: "current" },
              { q: "Q3", title: "Replay + Prompt Blocks", state: "planned" },
              { q: "Q4", title: "Live Coach", state: "planned" }
            ]}
          />
        </section>

        {/* ── SUBSCRIBE STRIP ── */}
        <section
          id="subscribe"
          className="relative rounded-3xl overflow-hidden text-white animate-slide-up"
          style={{
            backgroundImage:
              "linear-gradient(135deg, #4338CA 0%, #4F46E5 30%, #7C3AED 65%, #D946EF 100%)",
            boxShadow:
              "inset 0 1px 0 0 rgba(255,255,255,0.22), 0 30px 70px -30px rgba(124,58,237,0.55)"
          }}
        >
          {/* Mesh overlays */}
          <div
            className="absolute inset-0 opacity-70"
            aria-hidden="true"
            style={{
              backgroundImage: `
                radial-gradient(500px 240px at 90% 0%, rgba(255,255,255,0.25), transparent 60%),
                radial-gradient(600px 300px at 0% 100%, rgba(56,189,248,0.3), transparent 60%)
              `
            }}
          />
          <div className="absolute -top-10 -right-10 w-64 h-64 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-12 -left-10 w-48 h-48 rounded-full bg-white/10 blur-2xl" />

          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6 p-8 md:p-10">
            <div className="min-w-0">
              <h2 className="text-2xl md:text-3xl font-display font-bold tracking-tight mb-1.5">
                출시 알림 받기
              </h2>
              <p className="text-sm text-white/80">
                스팸 없음 · 출시 시 한 번의 메일만 보내드려요
              </p>
            </div>
            <form
              onSubmit={handleSubscribe}
              className="flex items-center gap-2 shrink-0 flex-wrap md:flex-nowrap w-full md:w-auto"
            >
              <div className="relative flex-1 md:flex-initial md:w-80">
                <Mail
                  size={15}
                  strokeWidth={2}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={subscribed ? "구독됨 ✓" : "이메일을 입력하세요"}
                  className="w-full pl-11 pr-4 py-3 rounded-full bg-white/95 text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-white/60 outline-none"
                />
              </div>
              <button
                type="submit"
                className={`shrink-0 inline-flex items-center gap-1.5 bg-white text-indigo-700 hover:bg-indigo-50 px-5 py-3 rounded-full font-semibold text-sm ${SPRING} hover:-translate-y-0.5 active:scale-[0.97]`}
                style={{
                  boxShadow: "0 1px 0 0 rgba(255,255,255,0.9) inset, 0 10px 20px -10px rgba(17,24,39,0.35)"
                }}
              >
                <span>구독하기</span>
                {subscribed && <Check size={14} strokeWidth={3} className="text-green-600" />}
              </button>
            </form>
          </div>
        </section>

        {/* ── Footer hint ── */}
        <p className="text-center text-xs italic text-gray-400 mt-8">
          질문/제안은 SSAFY 14기 D103 띠링띠링 팀에게 직접 알려주세요.
        </p>
      </div>
    </div>
  );
}

function WorkshopConsoleSection({
  form,
  setForm,
  state,
  readyCount,
  currentPreviewUrl,
  busy,
  onRefresh,
  onGenerate,
  onPromote
}: {
  form: WorkshopGenerateInput;
  setForm: Dispatch<SetStateAction<WorkshopGenerateInput>>;
  state: WorkshopState;
  readyCount: number;
  currentPreviewUrl: string;
  busy: boolean;
  onRefresh: () => void;
  onGenerate: (e: FormEvent<HTMLFormElement>) => void;
  onPromote: (variant: "a" | "b") => void;
}) {
  const variantA = state.variants.find((variant) => variant.id === "a");
  const variantB = state.variants.find((variant) => variant.id === "b");
  const disabled = busy || !state.configured;

  return (
    <section className="mb-16 animate-slide-up" style={{ animationDelay: "0.12s", animationFillMode: "both" }}>
      <div className="flex items-end justify-between gap-4 mb-5 flex-wrap">
        <div>
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500">
            Live Workshop
          </span>
          <h2 className="mt-2 text-2xl md:text-3xl font-display font-bold text-gray-900 tracking-tight">
            A/B 시안 생성과 반영
          </h2>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm font-semibold text-gray-700 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
        >
          <RefreshCw size={14} />
          새로고침
        </button>
      </div>

      <div className="rounded-3xl bg-white border border-gray-100 shadow-sm overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr]">
          <form onSubmit={onGenerate} className="p-6 border-b lg:border-b-0 lg:border-r border-gray-100 bg-gray-50/60">
            <div className="flex items-center justify-between gap-3 mb-5">
              <div>
                <div className="text-sm font-bold text-gray-900">생성 요청</div>
                <div className="text-xs text-gray-500 mt-1">
                  상태 {WORKSHOP_STATUS_LABEL[state.status]} · 준비 {readyCount}/2
                </div>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                  state.configured ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                }`}
              >
                {state.configured ? "Runtime Ready" : "Runtime 미설정"}
              </span>
            </div>

            {!state.configured && (
              <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs text-amber-800 leading-relaxed">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span>워크샵 런타임 경로가 준비되면 생성/반영 버튼이 활성화됩니다.</span>
              </div>
            )}

            <label className="block mb-4">
              <span className="block text-xs font-bold text-gray-500 mb-2">대상 라우트</span>
              <input
                value={form.targetPath}
                onChange={(e) => setForm((current) => ({ ...current, targetPath: e.target.value }))}
                placeholder="/login"
                spellCheck={false}
                className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-sm text-gray-800 outline-none focus:border-indigo-300"
              />
            </label>

            <label className="block mb-5">
              <span className="block text-xs font-bold text-gray-500 mb-2">수정 요청</span>
              <textarea
                value={form.prompt}
                onChange={(e) => setForm((current) => ({ ...current, prompt: e.target.value }))}
                rows={7}
                className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-sm text-gray-800 leading-relaxed outline-none focus:border-indigo-300 resize-none"
              />
            </label>

            <button
              type="submit"
              disabled={disabled}
              className={`w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-white font-semibold transition-all ${
                disabled ? "bg-gray-300 cursor-not-allowed" : "hover:-translate-y-0.5 shadow-lg"
              }`}
              style={
                disabled
                  ? undefined
                  : {
                      backgroundImage: "linear-gradient(90deg, #4F46E5, #7C3AED)",
                      boxShadow: "0 14px 30px -12px rgba(99, 102, 241, 0.5)"
                    }
              }
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              A/B 시안 생성
            </button>

            <div className="mt-5 rounded-xl border border-gray-100 bg-white px-3.5 py-3 text-xs text-gray-500 space-y-1">
              <div>대상: {state.targetPath || form.targetPath || "-"}</div>
              <div>업데이트: {formatWorkshopTime(state.updatedAt)}</div>
              {state.startedAt && <div>경과: {formatWorkshopElapsed(state.startedAt)}</div>}
              {state.runningStep && <div>단계: {state.runningStep}</div>}
              {state.error && <div className="text-rose-600">오류: {state.error}</div>}
            </div>
          </form>

          <div className="p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <div className="text-sm font-bold text-gray-900">시안 미리보기</div>
                <div className="text-xs text-gray-500 mt-1">
                  선택됨 {state.selectedVariant ? `${state.selectedVariant.toUpperCase()}안` : "없음"}
                </div>
              </div>
              {currentPreviewUrl !== "#" && (
                <a
                  href={currentPreviewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  열기
                  <ExternalLink size={12} />
                </a>
              )}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {variantA && (
                <WorkshopVariantCard
                  variant={variantA}
                  selected={state.selectedVariant === "a"}
                  busy={busy}
                  onPromote={onPromote}
                />
              )}
              {variantB && (
                <WorkshopVariantCard
                  variant={variantB}
                  selected={state.selectedVariant === "b"}
                  busy={busy}
                  onPromote={onPromote}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function WorkshopVariantCard({
  variant,
  selected,
  busy,
  onPromote
}: {
  variant: WorkshopVariantState;
  selected: boolean;
  busy: boolean;
  onPromote: (variant: "a" | "b") => void;
}) {
  const ready = variant.status === "ready";
  return (
    <article
      className={`rounded-2xl border overflow-hidden bg-white ${
        selected ? "border-indigo-300 shadow-lg shadow-indigo-100" : "border-gray-100"
      }`}
    >
      <header className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between gap-3 mb-2">
          <span className="inline-flex items-center gap-2 text-sm font-bold text-gray-900">
            <span className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 inline-flex items-center justify-center">
              {variant.id.toUpperCase()}
            </span>
            {variant.title}
          </span>
          <span
            className={`text-[10px] font-bold px-2 py-1 rounded-full ${
              ready
                ? "bg-green-100 text-green-700"
                : variant.status === "failed"
                  ? "bg-rose-100 text-rose-700"
                  : "bg-gray-100 text-gray-600"
            }`}
          >
            {VARIANT_STATUS_LABEL[variant.status]}
          </span>
        </div>
        <p className="text-xs text-gray-500 leading-relaxed">{variant.direction}</p>
      </header>

      <div className="h-64 bg-gray-50">
        {ready ? (
          <iframe
            src={variant.url}
            title={`${variant.title} 미리보기`}
            className="w-full h-full bg-white"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        ) : (
          <div className="h-full flex items-center justify-center text-center px-6">
            <div>
              <div className="text-sm font-semibold text-gray-700 mb-1">
                {variant.status === "running" || variant.status === "queued" ? "시안 생성 대기 중" : "미리보기 없음"}
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                {variant.error ?? variant.summary ?? "생성 요청을 실행하면 이 영역에 결과가 표시됩니다."}
              </p>
            </div>
          </div>
        )}
      </div>

      <footer className="p-4 flex items-center justify-between gap-3">
        <code className="text-[11px] text-gray-400 truncate">{variant.url}</code>
        <button
          type="button"
          disabled={!ready || busy}
          onClick={() => onPromote(variant.id)}
          className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            ready && !busy
              ? "bg-indigo-600 text-white hover:bg-indigo-700"
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
          }`}
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
          반영
        </button>
      </footer>
    </article>
  );
}

/* ─── MockupPreview (decorative) ─── */

function MockupPreview() {
  const traceSteps = [
    { n: 1, label: "요구사항 분석", time: "09:11" },
    { n: 2, label: "아키텍처 결정", time: "09:42" },
    { n: 3, label: "API 설계", time: "10:18", active: true },
    { n: 4, label: "데이터 모델링", time: "11:05" },
    { n: 5, label: "구현", time: "12:43" },
    { n: 6, label: "테스트", time: "13:27" },
    { n: 7, label: "리뷰 & 마무리", time: "14:02" }
  ];

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-5 py-3 bg-[#181535] border-b border-white/5">
        <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#7C3AED" }} />
        <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#14B8A6" }} />
        <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#F59E0B" }} />
        <span className="ml-4 text-xs text-white/60 font-semibold tracking-wide">
          Workshop
        </span>
        <span className="text-white/30">/</span>
        <span className="text-xs text-white/80">User Signup Flow</span>
      </div>

      {/* Body */}
      <div className="grid grid-cols-[180px_1fr_220px] text-white">
        {/* Left — Trace */}
        <div className="border-r border-white/5 p-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-3">
            Trace
          </div>
          <ul className="space-y-2">
            {traceSteps.map((s) => (
              <li
                key={s.n}
                className={`flex items-center gap-2 text-[11px] px-2 py-1.5 rounded-md ${
                  s.active ? "bg-indigo-500/20 ring-1 ring-indigo-400/40" : ""
                }`}
              >
                <span
                  className={`shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                    s.active
                      ? "bg-indigo-500 text-white"
                      : "bg-white/10 text-white/60"
                  }`}
                >
                  {s.n}
                </span>
                <span
                  className={`flex-1 truncate ${
                    s.active ? "text-white font-semibold" : "text-white/60"
                  }`}
                >
                  {s.label}
                </span>
                <span className="text-white/30 font-mono text-[9px]">{s.time}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Middle — Replay viewport */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="inline-flex items-center gap-2 text-[11px] text-indigo-300 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
              Replay · step 3 / 7
            </span>
            <div className="flex items-center gap-2 text-white/70">
              <button
                type="button"
                className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center"
              >
                <Play size={10} fill="currentColor" />
              </button>
              <button
                type="button"
                className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center"
              >
                <SkipForward size={10} />
              </button>
              <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded font-mono">
                1.0x
              </span>
            </div>
          </div>
          <div className="text-sm font-semibold mb-2">API 설계 — Auth Service</div>
          <ul className="text-[11px] text-white/70 space-y-1 mb-3 list-disc list-inside">
            <li>회원가입, 로그인, 토큰 갱신 API 정의</li>
            <li>JWT 기반 인증, Refresh Token 회전</li>
            <li>예외 처리 및 상태 코드 정책 수립</li>
          </ul>
          <pre className="text-[10px] leading-5 font-mono bg-[#0F0C2F] border border-white/5 rounded-lg px-3 py-2 overflow-hidden">
            <span className="text-green-400 font-bold">POST</span>{" "}
            <span className="text-white/90">/api/v1/auth/signup</span>
            {"\n"}
            <span className="text-white/50">{"{"}</span>
            {"\n"}
            {"  "}
            <span className="text-sky-300">&quot;email&quot;</span>:{" "}
            <span className="text-amber-300">&quot;user@example.com&quot;</span>,{"\n"}
            {"  "}
            <span className="text-sky-300">&quot;password&quot;</span>:{" "}
            <span className="text-amber-300">&quot;••••••••&quot;</span>,{"\n"}
            {"  "}
            <span className="text-sky-300">&quot;name&quot;</span>:{" "}
            <span className="text-amber-300">&quot;Jane Doe&quot;</span>
            {"\n"}
            <span className="text-white/50">{"}"}</span>
          </pre>
        </div>

        {/* Right — Annotations */}
        <div className="border-l border-white/5 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">
              Annotations
            </span>
            <span className="text-[10px] text-indigo-300 font-semibold inline-flex items-center gap-0.5">
              <Bookmark size={10} />+ Add
            </span>
          </div>
          <div className="space-y-2.5">
            <Annotation
              name="Jane"
              time="10:20"
              dotColor="#F59E0B"
              body="비밀번호 정책을 최소 8자리 이상으로 변경"
            />
            <Annotation
              name="Reviewer"
              time="10:21"
              dotColor="#14B8A6"
              body="보안 가이드 반영 완료"
              check
            />
            <Annotation
              name="Tutor"
              time="10:22"
              dotColor="#7C3AED"
              body="좋아요! 다음은 Refresh Token 전략을 고민해볼까요?"
            />
          </div>
        </div>
      </div>
    </>
  );
}

function Annotation({
  name,
  time,
  dotColor,
  body,
  check
}: {
  name: string;
  time: string;
  dotColor: string;
  body: string;
  check?: boolean;
}) {
  return (
    <div className="bg-white/5 rounded-lg p-2.5 border border-white/5">
      <div className="flex items-center justify-between mb-1">
        <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: dotColor }}
          />
          <span className="text-white/90">{name}</span>
          <span className="text-white/40 font-mono text-[9px]">{time}</span>
        </div>
        {check && (
          <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-teal-500/80 text-white">
            <Check size={8} strokeWidth={3} />
          </span>
        )}
      </div>
      <p className="text-[10px] text-white/70 leading-relaxed">{body}</p>
    </div>
  );
}

/* ─── TeaserCard ─── */

function TeaserCard({
  index,
  tag,
  tagCls,
  title,
  desc,
  progress,
  progressLabel,
  accent,
  delay
}: {
  index: string;
  tag: string;
  tagCls: string;
  title: string;
  desc: string;
  progress: number;
  progressLabel: string;
  accent: string;
  delay: number;
}) {
  return (
    <article
      className={`group relative overflow-hidden rounded-2xl ${GLASS} p-6 animate-slide-up ${SPRING} hover:-translate-y-1 hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,1),0_1px_2px_rgba(17,24,39,0.04),0_18px_36px_-18px_rgba(79,70,229,0.4)] active:scale-[0.99]`}
      style={{ animationDelay: `${delay}ms`, animationFillMode: "both" }}
    >
      {/* Ambient corner glow */}
      <div
        className={`pointer-events-none absolute -top-20 -right-20 w-52 h-52 rounded-full blur-3xl opacity-0 group-hover:opacity-60 transition-opacity duration-700 bg-gradient-to-br ${accent}`}
        aria-hidden="true"
      />

      {/* Top row: tag + index (left) | progress % (right) */}
      <div className="relative flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${tagCls}`}
          >
            {tag}
          </span>
          <span
            className={`font-mono font-bold text-xs tabular-nums bg-gradient-to-br ${accent} bg-clip-text text-transparent`}
          >
            {index}
          </span>
        </div>
        <span className="text-[11px] font-bold tabular-nums text-gray-900">
          {progressLabel}
        </span>
      </div>

      <h3 className="relative font-display font-bold text-gray-900 text-xl leading-tight mb-2 text-balance">
        {title}
      </h3>
      <p className="relative text-sm text-gray-500 leading-relaxed mb-6">{desc}</p>

      {/* 3D progress rail */}
      <div className="relative h-2 rounded-full bg-gray-200/80 overflow-hidden shadow-[inset_0_1px_2px_rgba(17,24,39,0.08)]">
        <div
          className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${accent} transition-[width] duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)]`}
          style={{
            width: `${progress}%`,
            boxShadow: "0 0 12px rgba(124,58,237,0.45)"
          }}
        />
      </div>
    </article>
  );
}

/* ─── Roadmap ─── */

function Roadmap({
  items
}: {
  items: { q: string; title: string; state: MilestoneState }[];
}) {
  const segmentCls = (left: MilestoneState, right: MilestoneState) => {
    if (left === "done" && right === "done") return "bg-indigo-400";
    if (left === "done" && right === "current")
      return "bg-gradient-to-r from-indigo-400 to-violet-500";
    if (left === "current")
      return "bg-gradient-to-r from-violet-500 to-gray-300";
    return "bg-gray-200";
  };

  return (
    <div className={`relative rounded-2xl ${GLASS} px-4 sm:px-8 py-8`}>
      {/* Dots + segments row */}
      <div className="flex items-center">
        {items.map((m, i) => (
          <div key={m.q} className="contents">
            <div className="relative flex items-center justify-center w-11 shrink-0">
              <MilestoneDot state={m.state} />
            </div>
            {i < items.length - 1 && (
              <div
                className={`flex-1 h-1 rounded-full mx-1 ${segmentCls(m.state, items[i + 1].state)}`}
                aria-hidden="true"
              />
            )}
          </div>
        ))}
      </div>

      {/* Labels row — each column aligns with its dot above */}
      <div className="mt-4 flex items-start">
        {items.map((m, i) => (
          <div key={m.q} className="contents">
            <div className="w-11 shrink-0 flex flex-col items-center text-center">
              <div className="font-display font-bold text-gray-900 text-sm leading-tight">
                {m.q}
              </div>
              <div
                className={`text-[11px] leading-tight mt-1 whitespace-nowrap ${
                  m.state === "current"
                    ? "text-indigo-600 font-semibold"
                    : m.state === "done"
                      ? "text-gray-700"
                      : "text-gray-400"
                }`}
              >
                {m.title}
              </div>
            </div>
            {i < items.length - 1 && <div className="flex-1 mx-1" aria-hidden="true" />}
          </div>
        ))}
      </div>
    </div>
  );
}

function MilestoneDot({ state }: { state: MilestoneState }) {
  if (state === "done") {
    return (
      <span
        className="relative inline-flex items-center justify-center w-11 h-11 rounded-full text-white"
        style={{
          backgroundImage: "linear-gradient(135deg, #6366F1 0%, #7C3AED 100%)",
          boxShadow:
            "inset 0 1px 0 0 rgba(255,255,255,0.35), 0 10px 20px -10px rgba(99,102,241,0.55)"
        }}
      >
        <Check size={18} strokeWidth={3} />
      </span>
    );
  }
  if (state === "current") {
    return (
      <span
        className="relative inline-flex items-center justify-center w-11 h-11 rounded-full text-white ring-4 ring-indigo-100"
        style={{
          backgroundImage: "linear-gradient(135deg, #7C3AED 0%, #D946EF 100%)",
          boxShadow:
            "inset 0 1px 0 0 rgba(255,255,255,0.35), 0 14px 26px -10px rgba(124,58,237,0.6)"
        }}
      >
        <span className="w-3 h-3 rounded-full bg-white" />
        <span className="absolute inset-0 rounded-full bg-violet-400 opacity-40 animate-ping" />
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-white/70 backdrop-blur-sm border border-gray-200/80"
      style={{ boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.9)" }}
    >
      <span className="w-2 h-2 rounded-full bg-gray-300" />
    </span>
  );
}

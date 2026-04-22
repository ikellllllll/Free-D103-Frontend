"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
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
  type LucideIcon
} from "lucide-react";

import { useUiStore } from "@/store/uiStore";

type MilestoneState = "done" | "current" | "planned";

export default function Dev2WorkshopPage() {
  const addToast = useUiStore((s) => s.addToast);
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

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

  return (
    <div className="relative bg-gradient-to-b from-indigo-50/40 via-white to-white min-h-screen overflow-hidden">
      {/* Floating orbs */}
      <div className="absolute top-0 left-0 right-0 h-[900px] pointer-events-none overflow-hidden">
        <div className="absolute -top-16 -left-40 w-[520px] h-[520px] rounded-full bg-violet-400/25 blur-3xl animate-blob-1" />
        <div className="absolute top-[8%] -right-40 w-[520px] h-[520px] rounded-full bg-teal-400/20 blur-3xl animate-blob-2" />
        <div className="absolute inset-0 bg-grid-pattern opacity-25" />
      </div>

      <div className="relative max-w-5xl mx-auto px-6 pt-28 pb-16">
        {/* ── HERO ── */}
        <section className="text-center animate-slide-up">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold mb-5">
            <Sparkles size={12} strokeWidth={2.4} />
            <span>Preview · Q2 2026</span>
          </div>

          <div
            className="text-xs font-bold uppercase tracking-[0.4em] mb-3 inline-block"
            style={{
              backgroundImage: "linear-gradient(90deg, #4F46E5, #7C3AED)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              color: "transparent"
            }}
          >
            W O R K S H O P
          </div>

          <h1 className="text-4xl md:text-6xl font-display font-bold text-gray-900 tracking-tight leading-[1.1] mb-5">
            공부가 아니라,
            <br />
            <span
              className="bg-gradient-animate"
              style={{
                backgroundImage: "linear-gradient(90deg, #4F46E5, #7C3AED, #4F46E5)",
                backgroundSize: "200% 200%",
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

          <p className="text-[15px] md:text-base text-gray-500 max-w-2xl mx-auto leading-relaxed mb-8">
            실무 시나리오를 AI와 함께 재연하며 프롬프트, Trace, 아키텍처 결정까지 되감기로 복습할 수 있도록 준비 중입니다.
          </p>

          <div className="flex items-center justify-center gap-3 flex-wrap">
            <a
              href="#subscribe"
              className="inline-flex items-center justify-center space-x-2 text-white font-semibold px-6 py-3 rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
              style={{
                backgroundImage: "linear-gradient(90deg, #4F46E5, #7C3AED)",
                boxShadow: "0 14px 30px -12px rgba(99, 102, 241, 0.5)"
              }}
            >
              <Mail size={16} strokeWidth={2.4} />
              <span>사전 알림 받기</span>
            </a>
            <a
              href="#roadmap"
              className="inline-flex items-center justify-center space-x-2 bg-white border border-gray-200 hover:border-indigo-300 text-gray-700 hover:text-indigo-600 font-semibold px-6 py-3 rounded-2xl transition-colors"
            >
              <span>로드맵 보기</span>
              <ArrowRight size={14} strokeWidth={2.4} />
            </a>
          </div>
        </section>

        {/* ── PREVIEW MOCKUP ── */}
        <section className="mt-16 mb-16">
          <div
            className="relative rounded-2xl overflow-hidden shadow-2xl mx-auto max-w-4xl animate-slide-up"
            style={{
              backgroundColor: "#1E1B4B",
              transform: "perspective(1200px) rotateX(2deg)",
              animationDelay: "0.08s",
              animationFillMode: "both"
            }}
          >
            <MockupPreview />
          </div>
        </section>

        {/* ── FEATURE TEASER CARDS ── */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-16">
          <TeaserCard
            icon={Film}
            iconBg="linear-gradient(135deg, #7C3AED, #A855F7)"
            tag="in design"
            tagCls="bg-violet-100 text-violet-700"
            title="시나리오 리플레이"
            desc="과제 풀이를 step-by-step으로 되감기하고, 에이전트 결정 포인트를 Figma처럼 코멘트할 수 있어요."
            progress={62}
            progressLabel="62% built"
            progressColor="#7C3AED"
            delay={0}
          />
          <TeaserCard
            icon={BookOpen}
            iconBg="linear-gradient(135deg, #0D9488, #14B8A6)"
            tag="prototyping"
            tagCls="bg-teal-100 text-teal-700"
            title="프롬프트 라이브러리"
            desc="팀이 만든 프롬프트 블록을 조합해 나만의 에이전트 쉘을 짜고, 동료 것을 리믹스해요."
            progress={38}
            progressLabel="38% built"
            progressColor="#14B8A6"
            delay={50}
          />
          <TeaserCard
            icon={Lightbulb}
            iconBg="linear-gradient(135deg, #F59E0B, #FBBF24)"
            tag="concept"
            tagCls="bg-amber-100 text-amber-700"
            title="라이브 코치"
            desc="풀이 중 헷갈리는 구간에 AI 멘토가 옆에서 짧은 힌트만 건네는 페어 모드."
            progress={12}
            progressLabel="12% concept"
            progressColor="#F59E0B"
            delay={100}
          />
        </section>

        {/* ── ROADMAP ── */}
        <section id="roadmap" className="mb-16">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500 mb-6">
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
              "linear-gradient(135deg, #4338CA 0%, #4F46E5 35%, #7C3AED 80%)"
          }}
        >
          <div className="absolute -top-10 -right-10 w-64 h-64 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-12 -left-10 w-48 h-48 rounded-full bg-white/10 blur-2xl" />

          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6 p-8 md:p-10">
            <div className="min-w-0">
              <h2 className="text-2xl md:text-3xl font-display font-bold tracking-tight mb-1">
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
                  className="w-full pl-11 pr-4 py-3 rounded-full bg-white text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-white/50 outline-none"
                />
              </div>
              <button
                type="submit"
                className="shrink-0 inline-flex items-center gap-1.5 bg-white text-indigo-700 hover:bg-indigo-50 px-5 py-3 rounded-full font-semibold text-sm transition-colors"
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
              name="AI Agent"
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
  icon: Icon,
  iconBg,
  tag,
  tagCls,
  title,
  desc,
  progress,
  progressLabel,
  progressColor,
  delay
}: {
  icon: LucideIcon;
  iconBg: string;
  tag: string;
  tagCls: string;
  title: string;
  desc: string;
  progress: number;
  progressLabel: string;
  progressColor: string;
  delay: number;
}) {
  return (
    <article
      className="relative bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg hover:border-indigo-200 transition-all p-6 animate-slide-up"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "both" }}
    >
      {/* Tag pill top center */}
      <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
        <span
          className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${tagCls}`}
        >
          {tag}
        </span>
      </div>

      <span
        className="inline-flex items-center justify-center w-12 h-12 rounded-xl text-white shadow-sm mb-3"
        style={{ backgroundImage: iconBg }}
      >
        <Icon size={20} strokeWidth={2.2} />
      </span>

      <h3 className="font-display font-bold text-gray-900 text-[17px] mb-1.5">
        {title}
      </h3>
      <p className="text-sm text-gray-500 leading-relaxed mb-5">{desc}</p>

      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: `${progress}%`, backgroundColor: progressColor }}
          />
        </div>
        <span className="shrink-0 text-xs font-bold tabular-nums" style={{ color: progressColor }}>
          {progressLabel}
        </span>
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
  return (
    <div className="relative bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-8">
      <div className="relative grid grid-cols-4 gap-4">
        {/* Connecting line underlay */}
        <div className="absolute top-[22px] left-[12.5%] right-[12.5%] flex items-center">
          {items.slice(0, -1).map((it, i) => {
            const nextState = items[i + 1].state;
            const cls =
              it.state === "done" && nextState === "done"
                ? "bg-green-400"
                : it.state === "done" && nextState === "current"
                  ? "bg-gradient-to-r from-green-400 to-indigo-400"
                  : it.state === "current"
                    ? "bg-gradient-to-r from-indigo-400 to-gray-200"
                    : "bg-gray-200 border-dashed border-t-2 border-gray-200";
            return (
              <div
                key={i}
                className={`flex-1 h-0.5 mx-1 ${it.state === "planned" ? "border-t-2 border-dashed border-gray-200 h-0" : cls}`}
              />
            );
          })}
        </div>

        {items.map((m) => (
          <div
            key={m.q}
            className="relative flex flex-col items-center text-center z-10"
          >
            <MilestoneDot state={m.state} />
            <div className="mt-3 font-display font-bold text-gray-900">{m.q}</div>
            <div
              className={`text-xs mt-0.5 ${
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
        ))}
      </div>
    </div>
  );
}

function MilestoneDot({ state }: { state: MilestoneState }) {
  if (state === "done") {
    return (
      <span className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-green-500 text-white shadow-sm">
        <Check size={18} strokeWidth={3} />
      </span>
    );
  }
  if (state === "current") {
    return (
      <span className="relative inline-flex items-center justify-center w-11 h-11 rounded-full bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 ring-4 ring-indigo-100">
        <span className="w-3 h-3 rounded-full bg-white" />
        <span className="absolute inset-0 rounded-full bg-indigo-400 opacity-50 animate-ping" />
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-white border-2 border-gray-200">
      <span className="w-2 h-2 rounded-full bg-gray-200" />
    </span>
  );
}

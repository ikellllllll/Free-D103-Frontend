"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Sparkles,
  ArrowRight,
  PlayCircle,
  MessageSquare,
  Bot,
  LineChart,
  ChevronRight,
  Activity,
  Minus,
  Square,
  X
} from "lucide-react";

const SECTION_IDS = ["hero", "features", "workflow", "demo", "reports", "cta"] as const;
type SectionId = (typeof SECTION_IDS)[number];

const SECTION_LABELS: Record<SectionId, string> = {
  hero: "홈",
  features: "기능",
  workflow: "워크플로",
  demo: "데모",
  reports: "리포트",
  cta: "시작하기"
};

const WORKFLOW = [
  {
    step: "01",
    label: "세션 시작",
    cmd: "aig session start --problem todo-api",
    tag: "세션",
    desc: "과제를 선택하고 AI 에이전트 세션을 초기화합니다. 파일 시스템이 준비되고 AI가 컨텍스트를 파악합니다.",
    img: "/problemsSession.png",
    alt: "세션 시작 화면"
  },
  {
    step: "02",
    label: "코드 수정 & Diff",
    cmd: "aig diff --show-changes",
    tag: "Diff 뷰",
    desc: "AI가 제안한 코드 변경 사항을 Diff 뷰로 확인합니다. 좌우 비교로 수정 전·후를 한눈에 파악할 수 있습니다.",
    img: "/problemsDIFF.png",
    alt: "코드 Diff 화면"
  },
  {
    step: "03",
    label: "Trace 분석",
    cmd: "aig trace --session current --detail",
    tag: "Trace",
    desc: "에이전트의 모든 Tool Call, LLM 호출, 실행 스팬을 실시간으로 기록합니다. 에이전트가 어떻게 사고하는지 투명하게 확인하세요.",
    img: "/Trace.png",
    alt: "Trace 분석 화면"
  },
  {
    step: "04",
    label: "제출 & 분석 중",
    cmd: "aig submit --session current",
    tag: "분석 중",
    desc: "코드를 제출하면 AI가 테스트 케이스 채점, 코드 리뷰, AI 활용 분석을 순차적으로 처리합니다.",
    img: "/reportrunning.png",
    alt: "제출 분석 진행 화면"
  },
  {
    step: "05",
    label: "피드백 리포트",
    cmd: "aig report --latest --format full",
    tag: "리포트 완성",
    desc: "하네스 점수 · 실행 품질 · AI 활용 역량 3가지 기준으로 분석된 맞춤형 리포트를 확인합니다.",
    img: "/report.png",
    alt: "피드백 리포트 화면"
  }
];

const IDE_STEPS = [
  {
    label: "코드 선택",
    status: "문제가 있는 로직을 드래그합니다.",
    question: "이 인증 로직에서 토큰 검증이 실패하는 이유를 알려줘.",
    answer: 'split("Bearer ")가 먼저 실행되고 있어요. null 체크 후 prefix 검증 순서로 바꾸면 됩니다.'
  },
  {
    label: "에이전트에게 질문",
    status: "선택한 코드가 에이전트 모드로 전달됩니다.",
    question: "이 인증 로직에서 토큰 검증이 실패하는 이유를 알려줘.",
    answer: 'split("Bearer ")가 먼저 실행되고 있어요. null 체크 후 prefix 검증 순서로 바꾸면 됩니다.'
  },
  {
    label: "답변 생성 중",
    status: "에이전트가 컨텍스트를 분석하고 있습니다.",
    question: "이 인증 로직에서 토큰 검증이 실패하는 이유를 알려줘.",
    answer: 'split("Bearer ")가 먼저 실행되고 있어요. null 체크 후 prefix 검증 순서로 바꾸면 됩니다.'
  },
  {
    label: "답변 도착",
    status: "원인 설명과 함께 수정 방향을 제안합니다.",
    question: "이 인증 로직에서 토큰 검증이 실패하는 이유를 알려줘.",
    answer: 'split("Bearer ")가 먼저 실행되고 있어요. null 체크 후 prefix 검증 순서로 바꾸면 됩니다.'
  }
];

export function LandingAIG() {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<Record<SectionId, HTMLElement | null>>({
    hero: null,
    features: null,
    workflow: null,
    demo: null,
    reports: null,
    cta: null
  });
  const [activeSection, setActiveSection] = useState<SectionId>("hero");

  // Workflow step selector
  const [activeStep, setActiveStep] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const step = WORKFLOW[activeStep];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTransitioning(true);
      window.setTimeout(() => {
        setActiveStep((p) => (p + 1) % WORKFLOW.length);
        setTransitioning(false);
      }, 300);
    }, 4000);
    return () => window.clearInterval(timer);
  }, []);

  const goToStep = useCallback((i: number) => {
    setActiveStep((prev) => {
      if (i === prev) return prev;
      setTransitioning(true);
      window.setTimeout(() => {
        setActiveStep(i);
        setTransitioning(false);
      }, 250);
      return prev;
    });
  }, []);

  // IDE live demo
  const [ideStep, setIdeStep] = useState(0);
  const [ideCursor, setIdeCursor] = useState(true);
  const ideStepData = IDE_STEPS[ideStep];

  useEffect(() => {
    const t = window.setInterval(
      () => setIdeStep((p) => (p + 1) % IDE_STEPS.length),
      3200
    );
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    const t = window.setInterval(() => setIdeCursor((p) => !p), 500);
    return () => window.clearInterval(t);
  }, []);

  const setSectionRef = useCallback(
    (id: SectionId) => (node: HTMLElement | null) => {
      sectionRefs.current[id] = node;
    },
    []
  );

  const scrollToSection = useCallback((id: SectionId) => {
    const node = sectionRefs.current[id];
    if (node) {
      node.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const handleAnchorJump = useCallback(
    (id: SectionId) => (event: React.MouseEvent) => {
      event.preventDefault();
      scrollToSection(id);
    },
    [scrollToSection]
  );

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) {
          const id = visible[0].target.getAttribute("data-section") as SectionId | null;
          if (id) setActiveSection(id);
        }
      },
      { root, threshold: [0.35, 0.55, 0.75] }
    );
    SECTION_IDS.forEach((id) => {
      const node = sectionRefs.current[id];
      if (node) observer.observe(node);
    });
    return () => observer.disconnect();
  }, []);

  const dots = useMemo(() => SECTION_IDS, []);

  return (
    <div
      ref={scrollRef}
      className="h-screen overflow-y-scroll scroll-smooth bg-white font-sans"
      style={{ scrollSnapType: "y mandatory" }}
    >
      {/* Section dots (right side, fixed) */}
      <div className="pointer-events-none fixed right-6 top-1/2 z-40 -translate-y-1/2 hidden md:flex flex-col items-center gap-3">
        {dots.map((id) => {
          const isActive = activeSection === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => scrollToSection(id)}
              aria-label={`${SECTION_LABELS[id]} 섹션으로 이동`}
              className={`pointer-events-auto group flex items-center gap-2 transition-all cursor-pointer ${
                isActive ? "text-indigo-600" : "text-gray-400 hover:text-indigo-500"
              }`}
            >
              <span
                className={`block rounded-full border transition-all ${
                  isActive
                    ? "w-3 h-3 border-indigo-600 bg-indigo-600 shadow-[0_0_0_4px_rgba(99,102,241,0.15)]"
                    : "w-2.5 h-2.5 border-gray-300 bg-white group-hover:border-indigo-400"
                }`}
              />
              <span
                className={`text-xs font-semibold uppercase tracking-wider transition-opacity ${
                  isActive ? "opacity-100" : "opacity-0 group-hover:opacity-70"
                }`}
              >
                {SECTION_LABELS[id]}
              </span>
            </button>
          );
        })}
      </div>

      {/* ────────────────── HERO SECTION (Dark) ────────────────── */}
      <section
        ref={setSectionRef("hero")}
        data-section="hero"
        id="hero"
        className="relative min-h-screen overflow-hidden bg-[#0F0F2E] text-white flex flex-col"
        style={{ scrollSnapAlign: "start", scrollSnapStop: "always" }}
      >
        {/* Floating orbs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-24 left-[8%] w-[420px] h-[420px] rounded-full bg-violet-500/40 blur-3xl animate-blob-1" />
          <div className="absolute top-10 right-[5%] w-[360px] h-[360px] rounded-full bg-teal-400/30 blur-3xl animate-blob-2" />
          <div className="absolute top-[55%] left-[35%] w-[260px] h-[260px] rounded-full bg-indigo-500/30 blur-3xl animate-float" />
          <div className="absolute inset-0 bg-grid-pattern opacity-[0.15]" />
        </div>

        {/* Pill nav */}
        <div className="relative z-10 pt-6 px-6">
          <nav className="mx-auto max-w-5xl flex items-center justify-between bg-white/95 backdrop-blur-md rounded-full px-5 py-2.5 shadow-xl shadow-indigo-900/30">
            <Link href="/dev2" className="flex items-center space-x-2 text-indigo-600 font-display font-bold text-lg group cursor-pointer">
              <Sparkles size={20} strokeWidth={2} className="transition-transform group-hover:rotate-12" />
              <span>AIG</span>
            </Link>
            <div className="hidden md:flex items-center space-x-8 text-sm font-medium text-gray-700">
              <a href="#features" onClick={handleAnchorJump("features")} className="hover:text-indigo-600 transition-colors cursor-pointer">기능</a>
              <a href="#workflow" onClick={handleAnchorJump("workflow")} className="hover:text-indigo-600 transition-colors cursor-pointer">워크플로</a>
              <a href="#reports" onClick={handleAnchorJump("reports")} className="hover:text-indigo-600 transition-colors cursor-pointer">리포트</a>
              <Link href="/dev2/login" className="hover:text-indigo-600 transition-colors cursor-pointer">로그인</Link>
            </div>
            <Link
              href="/dev2/signup"
              className="inline-flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-full transition-colors shadow-md cursor-pointer"
            >
              <span>무료로 시작</span>
              <ArrowRight size={14} strokeWidth={2.4} />
            </Link>
          </nav>
        </div>

        {/* Hero content */}
        <div className="relative z-10 flex-1 flex flex-col justify-center px-6 py-12 text-center max-w-4xl mx-auto w-full animate-slide-up">
          <div className="inline-flex self-center items-center space-x-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-3.5 py-1.5 text-xs font-semibold text-indigo-100 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-300 animate-dot-pulse" />
            <span>SSAFY 14기 · D103 자율 프로젝트</span>
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-display font-bold tracking-tight leading-[1.1] mb-6">
            AI 에이전트와 함께
            <br />
            실무 역량을 키우는
            <br />
            <span
              className="bg-gradient-animate"
              style={{
                backgroundImage: "linear-gradient(90deg, #A5B4FC, #99F6E4, #C4B5FD, #A5B4FC)",
                backgroundSize: "200% 200%",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                color: "transparent"
              }}
            >
              코딩 워크스페이스
            </span>
          </h1>

          <p className="text-base md:text-xl text-indigo-200/90 max-w-2xl mx-auto leading-relaxed mb-8">
            실무 과제를 풀고, 에이전트 흐름을 기록하고,
            <br className="hidden md:block" />
            AI 활용 역량을 피드백 리포트로 확인하세요.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/dev2/signup"
              className="inline-flex items-center space-x-2 bg-white text-indigo-900 hover:bg-indigo-50 font-semibold px-6 py-3.5 rounded-full transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 cursor-pointer"
            >
              <Sparkles size={18} strokeWidth={2.2} />
              <span>무료로 시작하기</span>
              <ArrowRight size={16} strokeWidth={2.4} />
            </Link>
            <a
              href="#features"
              onClick={handleAnchorJump("features")}
              className="inline-flex items-center space-x-2 bg-white/10 hover:bg-white/15 backdrop-blur-sm border border-white/20 text-white font-semibold px-6 py-3.5 rounded-full transition-colors cursor-pointer"
            >
              <PlayCircle size={18} strokeWidth={2.2} />
              <span>데모 보기</span>
            </a>
          </div>
        </div>

        {/* Stats bar (inside hero, bottom overlay) */}
        <div className="relative z-10 px-6 pb-10">
          <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-0 bg-white/[0.07] backdrop-blur-xl border border-white/15 rounded-2xl overflow-hidden">
            {[
              { value: "5종", label: "실무 과제" },
              { value: "2개", label: "지원 언어" },
              { value: "3가지", label: "평가 기준" },
              { value: "SSAFY 14기", label: "자율 프로젝트" }
            ].map((s, i) => (
              <div
                key={s.label}
                className={`text-center py-5 px-4 ${
                  i < 3 ? "md:border-r border-white/10" : ""
                } ${i === 1 ? "border-r md:border-r border-white/10" : ""} ${
                  i === 2 ? "border-t md:border-t-0 border-white/10" : ""
                } ${i === 3 ? "border-t md:border-t-0 border-white/10" : ""}`}
              >
                <div className="text-2xl md:text-3xl font-display font-bold text-white">
                  {s.value}
                </div>
                <div className="text-[11px] text-indigo-200/80 mt-1.5 font-medium tracking-widest uppercase">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ────────────────── FEATURES (3-up, spacious) ────────────────── */}
      <section
        ref={setSectionRef("features")}
        data-section="features"
        id="features"
        className="relative min-h-screen bg-white overflow-hidden flex flex-col justify-center py-20"
        style={{ scrollSnapAlign: "start", scrollSnapStop: "always" }}
      >
        <div className="absolute top-40 left-0 w-96 h-96 rounded-full bg-indigo-100/50 blur-3xl pointer-events-none" />
        <div className="absolute bottom-40 right-0 w-96 h-96 rounded-full bg-violet-100/50 blur-3xl pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-6 w-full">
          <div className="text-center mb-14">
            <div className="inline-flex items-center space-x-2 bg-indigo-50 border border-indigo-100 rounded-full px-3 py-1 text-xs font-semibold text-indigo-700 mb-5">
              <Sparkles size={12} strokeWidth={2.4} />
              <span>CORE FEATURES</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-display font-bold text-gray-900 tracking-tight mb-4">
              AI를 <span
                style={{
                  backgroundImage: "linear-gradient(90deg, #4F46E5, #7C3AED)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  color: "transparent"
                }}
              >어떻게 쓰느냐</span>를
              <br />
              평가합니다
            </h2>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">
              단순히 AI를 허용하는 게 아니라, AI를 설계하고 활용하는 과정을 Trace로 기록하고 피드백합니다.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 stagger-children">
            {[
              {
                icon: MessageSquare,
                title: "Chat Mode",
                tag: "질문하는 능력",
                desc: "AI에게 직접 질문하고 답변을 받으며 코드를 작성합니다. 프롬프트 품질이 곧 실력입니다.",
                iconBg: "linear-gradient(135deg, #6366F1, #4F46E5)",
                tagColor: "#4F46E5"
              },
              {
                icon: Bot,
                title: "Agent Mode",
                tag: "설계하는 능력",
                desc: "하네스를 설계하고 에이전트에게 과제를 위임합니다. 자율 실행된 에이전트의 Trace가 남습니다.",
                iconBg: "linear-gradient(135deg, #8B5CF6, #7C3AED)",
                tagColor: "#7C3AED"
              },
              {
                icon: LineChart,
                title: "AI 피드백 리포트",
                tag: "객관적 평가",
                desc: "하네스 품질 · 실행 품질 · Trace 활용 3가지 기준으로 AI 활용 역량을 수치화합니다.",
                iconBg: "linear-gradient(135deg, #14B8A6, #0D9488)",
                tagColor: "#0D9488"
              }
            ].map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="group relative bg-white rounded-3xl border border-gray-100 p-8 hover:-translate-y-1 hover:shadow-2xl transition-all animate-slide-up cursor-default"
                  style={{ animationFillMode: "both" }}
                >
                  <div
                    className="flex items-center justify-center w-14 h-14 rounded-2xl mb-6 shadow-lg transition-all"
                    style={{
                      backgroundImage: f.iconBg,
                      boxShadow: "0 10px 25px -10px rgba(99, 102, 241, 0.4)"
                    }}
                  >
                    <Icon size={26} strokeWidth={2} className="text-white" />
                  </div>
                  <div
                    className="text-[11px] font-mono font-semibold uppercase tracking-wider mb-2"
                    style={{ color: f.tagColor }}
                  >
                    {f.tag}
                  </div>
                  <h3 className="text-xl font-display font-bold text-gray-900 mb-3">{f.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{f.desc}</p>
                  <div className="mt-6 inline-flex items-center space-x-1 text-sm font-semibold text-indigo-600 opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all cursor-pointer">
                    <span>자세히 보기</span>
                    <ChevronRight size={14} strokeWidth={2.4} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ────────────────── WORKFLOW (Interactive step selector) ────────────────── */}
      <section
        ref={setSectionRef("workflow")}
        data-section="workflow"
        id="workflow"
        className="relative min-h-screen bg-gradient-to-b from-indigo-50/40 via-white to-white flex flex-col justify-center py-16 overflow-hidden"
        style={{ scrollSnapAlign: "start", scrollSnapStop: "always" }}
      >
        <div className="max-w-6xl mx-auto px-6 w-full">
          <div className="text-center mb-10">
            <div className="inline-flex items-center space-x-2 bg-white border border-indigo-100 rounded-full px-3 py-1 text-xs font-semibold text-indigo-700 mb-4 shadow-sm">
              <Activity size={12} strokeWidth={2.4} />
              <span>실제 워크플로</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-display font-bold text-gray-900 tracking-tight mb-3">
              세션 시작부터 리포트까지
              <br />
              <span
                className="bg-gradient-animate"
                style={{
                  backgroundImage: "linear-gradient(90deg, #4F46E5, #7C3AED, #14B8A6, #4F46E5)",
                  backgroundSize: "200% 200%",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  color: "transparent"
                }}
              >
                한 흐름으로
              </span>
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] gap-8 items-center">
            {/* Left — steps + terminal */}
            <div className="flex flex-col gap-3">
              {WORKFLOW.map((w, i) => {
                const active = i === activeStep;
                return (
                  <button
                    key={w.step}
                    type="button"
                    onClick={() => goToStep(i)}
                    className={`group w-full text-left flex items-center gap-4 px-5 py-3.5 rounded-2xl border transition-all cursor-pointer ${
                      active
                        ? "bg-white border-indigo-200 shadow-[0_12px_30px_-12px_rgba(99,102,241,0.45)] -translate-y-0.5"
                        : "bg-white/60 border-gray-100 hover:bg-white hover:border-gray-200"
                    }`}
                  >
                    <span
                      className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-display font-bold text-sm transition-colors ${
                        active ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-500 group-hover:bg-gray-200"
                      }`}
                    >
                      {w.step}
                    </span>
                    <span
                      className={`flex-1 font-semibold transition-colors ${
                        active ? "text-gray-900" : "text-gray-500 group-hover:text-gray-700"
                      }`}
                    >
                      {w.label}
                    </span>
                    {active && (
                      <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-full px-2 py-0.5">
                        {w.tag}
                      </span>
                    )}
                  </button>
                );
              })}

              {/* Terminal card */}
              <div className="mt-2 rounded-2xl overflow-hidden border border-gray-200 shadow-xl shadow-indigo-900/5 bg-[#1E1B4B]">
                <div className="flex items-center justify-between px-4 py-2 bg-[#171450] border-b border-white/5">
                  <span className="text-[11px] font-mono text-indigo-200/70">aig-terminal</span>
                  <div className="flex items-center gap-1.5">
                    <Minus size={10} className="text-indigo-200/40" strokeWidth={3} />
                    <Square size={8} className="text-indigo-200/40" strokeWidth={3} />
                    <X size={10} className="text-indigo-200/40" strokeWidth={3} />
                  </div>
                </div>
                <div className="px-4 py-3 font-mono text-[13px] leading-6">
                  <div className="text-indigo-200/80">
                    <span className="text-teal-300">user@aig</span>
                    <span className="text-indigo-200/50">:</span>
                    <span className="text-indigo-300">~/workspace</span>
                    <span className="text-indigo-200/50">$ </span>
                  </div>
                  <div
                    className={`text-white font-medium transition-opacity duration-200 ${
                      transitioning ? "opacity-0" : "opacity-100"
                    }`}
                  >
                    {step.cmd}
                  </div>
                  <div
                    className={`mt-2 text-xs text-indigo-200/70 leading-relaxed transition-opacity duration-200 ${
                      transitioning ? "opacity-0" : "opacity-100"
                    }`}
                  >
                    {step.desc}
                  </div>
                </div>
              </div>
            </div>

            {/* Right — screenshot + progress dots */}
            <div className="flex flex-col items-stretch gap-3">
              <div className="flex items-center gap-2 px-1">
                {WORKFLOW.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => goToStep(i)}
                    aria-label={`단계 ${i + 1}로 이동`}
                    className={`flex-1 h-1.5 rounded-full transition-all cursor-pointer ${
                      i === activeStep
                        ? "bg-indigo-500"
                        : i < activeStep
                          ? "bg-indigo-300"
                          : "bg-gray-200 hover:bg-gray-300"
                    }`}
                  />
                ))}
              </div>
              <div className="relative rounded-3xl border border-gray-200 bg-white/60 backdrop-blur p-2 shadow-2xl shadow-indigo-900/10">
                <div className="absolute -inset-10 -z-10 bg-gradient-to-br from-indigo-200/40 via-violet-200/30 to-teal-200/30 blur-3xl rounded-full" />
                <div className="relative aspect-[16/10] rounded-2xl overflow-hidden bg-gray-100">
                  <Image
                    src={step.img}
                    alt={step.alt}
                    fill
                    sizes="(max-width: 1024px) 100vw, 60vw"
                    className={`object-cover transition-opacity duration-300 ${
                      transitioning ? "opacity-0" : "opacity-100"
                    }`}
                    priority={activeStep === 0}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ────────────────── IDE LIVE DEMO ────────────────── */}
      <section
        ref={setSectionRef("demo")}
        data-section="demo"
        id="demo"
        className="relative min-h-screen bg-[#0F0F2E] text-white overflow-hidden flex flex-col justify-center py-16"
        style={{ scrollSnapAlign: "start", scrollSnapStop: "always" }}
      >
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-[12%] w-[380px] h-[380px] rounded-full bg-violet-500/30 blur-3xl animate-blob-1" />
          <div className="absolute bottom-20 right-[8%] w-[320px] h-[320px] rounded-full bg-teal-400/25 blur-3xl animate-blob-2" />
          <div className="absolute inset-0 bg-grid-pattern opacity-[0.1]" />
        </div>

        <div className="relative max-w-6xl mx-auto px-6 w-full">
          <div className="text-center mb-10">
            <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-3 py-1 text-xs font-semibold text-indigo-100 mb-4">
              <PlayCircle size={12} strokeWidth={2.4} />
              <span>라이브 데모</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-display font-bold tracking-tight mb-3">
              실제 화면처럼 흐르는 워크플로
            </h2>
            <p className="text-base md:text-lg text-indigo-200/80 max-w-2xl mx-auto">
              문제 풀이 화면에서 코드를 선택하고, 에이전트 모드로 질문을 보내고, 답변이 도착하는 순간까지.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-5 items-stretch">
            {/* Left — IDE window mock */}
            <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-[#0A0A20] shadow-2xl shadow-indigo-900/30">
              <div className="flex items-center justify-between px-3 py-2 bg-[#161341] border-b border-white/5">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-rose-400/80" />
                  <span className="w-3 h-3 rounded-full bg-amber-400/80" />
                  <span className="w-3 h-3 rounded-full bg-emerald-400/80" />
                </div>
                <span className="text-[11px] font-mono text-indigo-200/60 truncate">/dev2/ide/session-e89y3kqx-mo6u209l</span>
                <span className="text-[11px] font-semibold text-indigo-200/80">Live IDE Session</span>
              </div>
              <div className="relative aspect-[16/10]">
                <Image
                  src="/problemsSession.png"
                  alt="실무 과제 풀이 세션"
                  fill
                  sizes="(max-width: 1024px) 100vw, 60vw"
                  className="object-cover"
                />
                {/* Code focus overlay */}
                <div
                  className={`absolute left-[32%] top-[42%] w-[28%] h-[12%] rounded-lg border-2 border-indigo-400/70 bg-indigo-500/10 transition-all duration-500 ${
                    ideStep >= 0 ? "opacity-100" : "opacity-0"
                  }`}
                />
                {/* Cursor tooltip */}
                <div
                  className={`absolute left-[58%] top-[48%] transition-all duration-500 ${
                    ideStep <= 1 ? "opacity-100" : "opacity-0"
                  }`}
                >
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-600 text-white text-[11px] font-semibold shadow-lg shadow-indigo-900/50 whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    드래그 후 질문
                  </div>
                </div>
                {/* Mini diff card */}
                <div
                  className={`absolute right-3 bottom-3 w-[40%] rounded-xl border border-white/15 bg-[#1E1B4B]/90 backdrop-blur-md shadow-xl transition-all duration-500 ${
                    ideStep >= 3 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                  }`}
                >
                  <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/10">
                    <span className="text-[10px] font-semibold text-white">변경 제안 미리보기</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-200 border border-amber-400/30">
                      Diff
                    </span>
                  </div>
                  <div className="relative aspect-[16/9]">
                    <Image
                      src="/problemsDIFF.png"
                      alt="코드 diff"
                      fill
                      sizes="260px"
                      className="object-cover"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right — Agent panel */}
            <div className="rounded-2xl overflow-hidden border border-white/10 bg-white/[0.03] backdrop-blur-sm flex flex-col">
              <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-white/10">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-indigo-300 mb-1">Agent Mode</p>
                  <h3 className="text-[15px] font-bold text-white">선택한 코드에 대해 바로 묻기</h3>
                </div>
                <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 whitespace-nowrap">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-300 animate-pulse" />
                  {ideStepData.label}
                </span>
              </div>

              <div className="flex-1 min-h-0 px-4 py-4 space-y-3">
                {/* User message */}
                <div className="space-y-1">
                  <span className="inline-block text-[10px] font-mono text-indigo-300/80 uppercase tracking-wider">질문</span>
                  <div className="rounded-xl rounded-tl-sm px-3 py-2 bg-indigo-500/15 border border-indigo-400/20 text-sm text-white leading-relaxed">
                    {ideStepData.question}
                  </div>
                </div>

                {/* Agent message */}
                <div
                  className={`space-y-1 transition-all duration-300 ${
                    ideStep < 2 ? "opacity-0 -translate-y-2 pointer-events-none" : "opacity-100"
                  }`}
                >
                  <span className="inline-block text-[10px] font-mono text-teal-300/80 uppercase tracking-wider">에이전트</span>
                  <div className="rounded-xl rounded-tl-sm px-3 py-2 bg-white/[0.06] border border-white/10 text-sm text-indigo-100 leading-relaxed">
                    {ideStep === 2 ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-300 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-300 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-300 animate-bounce" style={{ animationDelay: "300ms" }} />
                      </span>
                    ) : (
                      ideStepData.answer
                    )}
                  </div>
                </div>

                {/* Note */}
                <div
                  className={`flex items-start gap-2 p-3 rounded-xl bg-amber-400/10 border border-amber-400/20 transition-all duration-300 ${
                    ideStep < 3 ? "opacity-0 -translate-y-2 pointer-events-none" : "opacity-100"
                  }`}
                >
                  <Sparkles size={14} className="shrink-0 mt-0.5 text-amber-300" />
                  <div className="text-xs leading-relaxed">
                    <strong className="text-amber-200 font-semibold">수정 제안</strong>{" "}
                    <span className="text-indigo-200/80">
                      오른쪽 답변과 함께 diff 미리보기가 열려 바로 적용 여부를 판단할 수 있습니다.
                    </span>
                  </div>
                </div>
              </div>

              <div className="px-4 py-2 border-t border-white/10 font-mono text-[11px] text-indigo-200/60 flex items-center flex-wrap gap-x-1">
                <span className="text-teal-300">agent@aig</span>
                <span className="text-indigo-200/50">:</span>
                <span className="text-indigo-300">selection</span>
                <span className="text-indigo-200/50">$ </span>
                <span className="text-indigo-200/80">{ideStepData.status}</span>
                <span style={{ opacity: ideCursor ? 1 : 0 }} className="ml-0.5 text-indigo-200">|</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ────────────────── REPORT TEASER ────────────────── */}
      <section
        ref={setSectionRef("reports")}
        data-section="reports"
        id="reports"
        className="relative min-h-screen bg-white overflow-hidden flex flex-col justify-center py-20"
        style={{ scrollSnapAlign: "start", scrollSnapStop: "always" }}
      >
        <div className="max-w-6xl mx-auto px-6 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="animate-slide-up">
              <div className="inline-flex items-center space-x-2 bg-teal-50 border border-teal-100 rounded-full px-3 py-1 text-xs font-semibold text-teal-700 mb-6">
                <LineChart size={12} strokeWidth={2.4} />
                <span>FEEDBACK REPORT</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-display font-bold text-gray-900 tracking-tight leading-tight mb-6">
                내가 AI를
                <br />
                <span
                  style={{
                    backgroundImage: "linear-gradient(90deg, #0D9488, #4F46E5)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                    color: "transparent"
                  }}
                >
                  어떻게 썼는지
                </span>
                <br />
                객관적으로
              </h2>
              <p className="text-lg text-gray-600 leading-relaxed mb-8">
                하네스 품질 · 실행 품질 · Trace 활용 3가지 기준의 정량 분석과 함께,
                잘한 점과 개선할 점을 구체적인 사례로 제시합니다.
              </p>
              <Link
                href="/dev2/signup"
                className="inline-flex items-center space-x-2 text-white font-semibold px-6 py-3 rounded-full transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 cursor-pointer"
                style={{
                  backgroundImage: "linear-gradient(90deg, #4F46E5, #7C3AED)",
                  boxShadow: "0 10px 25px -8px rgba(99, 102, 241, 0.5)"
                }}
              >
                <span>리포트 체험하기</span>
                <ArrowRight size={16} strokeWidth={2.4} />
              </Link>
            </div>

            {/* Mock score card */}
            <div className="relative animate-scale-in">
              <div className="absolute -inset-8 bg-gradient-to-br from-indigo-200/40 via-violet-200/40 to-teal-200/40 blur-3xl rounded-full pointer-events-none" />
              <div className="relative bg-white rounded-3xl border border-gray-100 shadow-2xl p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-mono uppercase tracking-wider text-indigo-600 font-semibold mb-1">
                      종합 점수
                    </div>
                    <div className="text-5xl font-display font-bold text-gray-900">
                      82<span className="text-2xl text-gray-400">/100</span>
                    </div>
                    <div className="inline-flex items-center space-x-1 mt-2 text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-100 rounded-full px-2.5 py-0.5">
                      <span>상위 27%</span>
                    </div>
                  </div>
                  <div
                    className="w-24 h-24 rounded-full flex items-center justify-center text-white shadow-lg"
                    style={{
                      backgroundImage: "linear-gradient(135deg, #6366F1, #7C3AED)",
                      boxShadow: "0 15px 30px -10px rgba(99, 102, 241, 0.5)"
                    }}
                  >
                    <LineChart size={36} strokeWidth={1.5} />
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-gray-100">
                  {[
                    { label: "하네스 품질", score: 85, bar: "linear-gradient(90deg, #6366F1, #4F46E5)" },
                    { label: "실행 품질", score: 78, bar: "linear-gradient(90deg, #8B5CF6, #7C3AED)" },
                    { label: "Trace 활용", score: 84, bar: "linear-gradient(90deg, #14B8A6, #0D9488)" }
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium text-gray-700">{item.label}</span>
                        <span className="text-sm font-bold text-gray-900">{item.score}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${item.score}%`,
                            backgroundImage: item.bar
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ────────────────── CTA + FOOTER (combined to one snap section) ────────────────── */}
      <section
        ref={setSectionRef("cta")}
        data-section="cta"
        id="cta"
        className="relative min-h-screen bg-[#0F0F2E] text-white overflow-hidden flex flex-col"
        style={{ scrollSnapAlign: "start", scrollSnapStop: "always" }}
      >
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-[20%] w-96 h-96 rounded-full bg-violet-500/30 blur-3xl animate-blob-1" />
          <div className="absolute bottom-0 right-[15%] w-96 h-96 rounded-full bg-teal-400/30 blur-3xl animate-blob-2" />
          <div className="absolute inset-0 bg-grid-pattern opacity-[0.15]" />
        </div>

        <div className="relative flex-1 flex flex-col justify-center max-w-3xl mx-auto px-6 text-center w-full">
          <h2 className="text-4xl md:text-5xl font-display font-bold tracking-tight mb-6 leading-tight">
            AI 시대의 개발자 역량,
            <br />
            <span
              className="bg-gradient-animate"
              style={{
                backgroundImage: "linear-gradient(90deg, #A5B4FC, #99F6E4, #C4B5FD, #A5B4FC)",
                backgroundSize: "200% 200%",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                color: "transparent"
              }}
            >
              지금 증명하세요
            </span>
          </h2>
          <p className="text-lg text-indigo-200/80 mb-10 leading-relaxed">
            로그인 후 과제를 선택하고 AI와 함께 풀어보세요.
          </p>
          <div className="flex justify-center">
            <Link
              href="/dev2/signup"
              className="inline-flex items-center space-x-2 bg-white text-indigo-900 hover:bg-indigo-50 font-semibold px-8 py-4 rounded-full transition-all shadow-2xl hover:-translate-y-0.5 cursor-pointer"
            >
              <Sparkles size={18} strokeWidth={2.2} />
              <span>AIG 시작하기</span>
              <ArrowRight size={16} strokeWidth={2.4} />
            </Link>
          </div>
        </div>

        {/* Footer nested inside the cta snap section */}
        <footer className="relative bg-[#0A0A20] text-indigo-200/80 py-10 border-t border-white/10">
          <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between gap-6">
            <div>
              <Link href="/dev2" className="inline-flex items-center space-x-2 text-white font-display font-bold text-lg mb-2 cursor-pointer">
                <Sparkles size={18} strokeWidth={2} />
                <span>AIG</span>
              </Link>
              <p className="text-xs text-indigo-200/60 max-w-md leading-relaxed">
                AI-Based Integrated Ground · SSAFY 14기 D103 자율 프로젝트
              </p>
            </div>
            <div className="grid grid-cols-3 gap-8 text-xs">
              <div>
                <h4 className="text-white font-semibold mb-2 uppercase tracking-wider">Product</h4>
                <ul className="space-y-1.5">
                  <li><a href="#features" onClick={handleAnchorJump("features")} className="hover:text-white transition-colors cursor-pointer">기능</a></li>
                  <li><a href="#workflow" onClick={handleAnchorJump("workflow")} className="hover:text-white transition-colors cursor-pointer">워크플로</a></li>
                  <li><a href="#reports" onClick={handleAnchorJump("reports")} className="hover:text-white transition-colors cursor-pointer">리포트</a></li>
                </ul>
              </div>
              <div>
                <h4 className="text-white font-semibold mb-2 uppercase tracking-wider">Start</h4>
                <ul className="space-y-1.5">
                  <li><Link href="/dev2/login" className="hover:text-white transition-colors cursor-pointer">로그인</Link></li>
                  <li><Link href="/dev2/signup" className="hover:text-white transition-colors cursor-pointer">회원가입</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="text-white font-semibold mb-2 uppercase tracking-wider">Team</h4>
                <ul className="space-y-1.5">
                  <li>D103 띠링띠링</li>
                  <li className="text-indigo-200/50">SSAFY 14기</li>
                  <li>
                    <Link href="/dev2/terms" className="hover:text-white transition-colors cursor-pointer">
                      이용약관
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <div className="max-w-6xl mx-auto px-6 mt-6 pt-4 border-t border-white/5 flex flex-wrap justify-between text-[11px] text-indigo-200/40">
            <span>© 2026 AIG · D103 띠링띠링</span>
            <span>Design the agent. Master the harness.</span>
          </div>
        </footer>
      </section>
    </div>
  );
}

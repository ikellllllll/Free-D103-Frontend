"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";

import { useDevTheme, THEME_OPTIONS } from "@/components/dev/DevThemeContext";

const SNAP_IDS = ["hero", "stats", "workflow", "ide-demo", "features", "cta"] as const;
const SHOW_SCROLL_DEBUG = false;

const WORKFLOW = [
  {
    step: "01",
    label: "세션 시작",
    cmd: "aig session start --problem todo-api",
    tag: "세션",
    desc: "과제를 선택하고 AI 에이전트 세션을 초기화합니다. 파일 시스템이 준비되고 AI가 컨텍스트를 파악합니다.",
    img: "/problemsSession.png",
    alt: "세션 시작 화면",
  },
  {
    step: "02",
    label: "코드 수정 & Diff",
    cmd: "aig diff --show-changes",
    tag: "Diff 뷰",
    desc: "AI가 제안한 코드 변경 사항을 Diff 뷰로 확인합니다. 좌우 비교로 수정 전·후를 한눈에 파악할 수 있습니다.",
    img: "/problemsDIFF.png",
    alt: "코드 Diff 화면",
  },
  {
    step: "03",
    label: "Trace 분석",
    cmd: "aig trace --session current --detail",
    tag: "Trace",
    desc: "에이전트의 모든 Tool Call, LLM 호출, 실행 스팬을 실시간으로 기록합니다. 에이전트가 어떻게 사고하는지 투명하게 확인하세요.",
    img: "/Trace.png",
    alt: "Trace 분석 화면",
  },
  {
    step: "04",
    label: "제출 & 분석 중",
    cmd: "aig submit --session current",
    tag: "분석 중",
    desc: "코드를 제출하면 AI가 테스트 케이스 채점, 코드 리뷰, AI 활용 분석을 순차적으로 처리합니다.",
    img: "/reportrunning.png",
    alt: "제출 분석 진행 화면",
  },
  {
    step: "05",
    label: "피드백 리포트",
    cmd: "aig report --latest --format full",
    tag: "리포트 완성",
    desc: "하네스 점수 · 실행 품질 · AI 활용 역량 3가지 기준으로 분석된 맞춤형 리포트를 확인합니다.",
    img: "/report.png",
    alt: "피드백 리포트 화면",
  },
];

const FEATURES = [
  {
    title: "실무 과제",
    desc: "API 구현·버그 수정 등 실무 기반 백엔드 시나리오. Java와 Python을 지원합니다.",
    img: "/problemsPage.png",
    tag: "5종 · Java · Python",
  },
  {
    title: "Agent / Chat 모드",
    desc: "AI를 자율 에이전트로 쓸지, 직접 대화할지 선택하세요. 두 모드 모두 Trace가 기록됩니다.",
    img: "/problemsSession.png",
    tag: "agent mode · chat mode",
  },
  {
    title: "AI 피드백 리포트",
    desc: "제출 후 하네스 점수·실행 품질·AI 활용 역량을 분석해 역량 향상에 필요한 인사이트를 제공합니다.",
    img: "/report.png",
    tag: "3가지 점수 기준",
  },
];

const STATS = [
  { value: "5종", label: "실무 과제" },
  { value: "2개", label: "지원 언어" },
  { value: "3가지", label: "평가 기준" },
  { value: "14기", label: "SSAFY" },
];

const IDE_STEPS = [
  {
    label: "코드 선택",
    status: "문제가 있는 로직을 드래그합니다.",
    question: "이 인증 로직에서 토큰 검증이 실패하는 이유를 알려줘.",
    answer: 'split("Bearer ")가 먼저 실행되고 있어요. null 체크 후 prefix 검증 순서로 바꾸면 됩니다.',
  },
  {
    label: "에이전트에게 질문",
    status: "선택한 코드가 에이전트 모드로 전달됩니다.",
    question: "이 인증 로직에서 토큰 검증이 실패하는 이유를 알려줘.",
    answer: 'split("Bearer ")가 먼저 실행되고 있어요. null 체크 후 prefix 검증 순서로 바꾸면 됩니다.',
  },
  {
    label: "답변 생성 중",
    status: "에이전트가 컨텍스트를 분석하고 있습니다.",
    question: "이 인증 로직에서 토큰 검증이 실패하는 이유를 알려줘.",
    answer: 'split("Bearer ")가 먼저 실행되고 있어요. null 체크 후 prefix 검증 순서로 바꾸면 됩니다.',
  },
  {
    label: "답변 도착",
    status: "원인 설명과 함께 수정 방향을 제안합니다.",
    question: "이 인증 로직에서 토큰 검증이 실패하는 이유를 알려줘.",
    answer: 'split("Bearer ")가 먼저 실행되고 있어요. null 체크 후 prefix 검증 순서로 바꾸면 됩니다.',
  },
];


function V3ThemeLogo({ height = 30 }: { height?: number }) {
  return (
    <svg
      className="v3-theme-logo"
      width="960"
      height="275"
      viewBox="110 65 960 275"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="AIGround"
      role="img"
      style={{ height, width: "auto" }}
    >
      <text
        x="130"
        y="218"
        fill="var(--v3-mint)"
        fontSize="188"
        fontWeight="800"
        fontFamily="'Segoe UI', Arial, sans-serif"
        letterSpacing="-6"
      >
        AIG
      </text>
      <text
        x="470"
        y="218"
        fill="var(--v3-sage)"
        fontSize="128"
        fontWeight="600"
        fontFamily="'Segoe UI', Arial, sans-serif"
        letterSpacing="-3"
      >
        round
      </text>
      <rect x="132" y="250" width="925" height="5" rx="2.5" fill="var(--v3-teal)" />
      <text
        x="132"
        y="314"
        fill="var(--v3-mint-dim)"
        fontSize="46"
        fontWeight="500"
        fontFamily="'Segoe UI', Arial, sans-serif"
        letterSpacing="8"
      >
        AI-BASED INTEGRATED GROUND
      </text>
    </svg>
  );
}

export function LandingV3() {
  const [activeStep, setActiveStep] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const [ideStep, setIdeStep] = useState(0);
  const [ideCursor, setIdeCursor] = useState(true);
  const { themeTone, setThemeTone: updateThemeTone } = useDevTheme();
  const [currentSection, setCurrentSection] = useState(0);
  const currentSectionRef = useRef(0);
  const isScrollingRef = useRef(false);
  const [snapDebug, setSnapDebug] = useState({
    scrollY: 0,
    secondTop: 0,
    secondTarget: 0,
    workflowTarget: 0,
    liveTarget: 0,
    featuresTarget: 0,
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setTransitioning(true);
      setTimeout(() => {
        setActiveStep((p) => (p + 1) % WORKFLOW.length);
        setTransitioning(false);
      }, 300);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setIdeStep((p) => (p + 1) % IDE_STEPS.length), 3200);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setIdeCursor((p) => !p), 500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!SHOW_SCROLL_DEBUG) return;

    const getTarget = (id: (typeof SNAP_IDS)[number]) => {
      if (id === "hero") return 0;
      if (id === "stats") return 609;
      const el = document.getElementById(id);
      if (!el) return 0;
      const offset = id === "ide-demo" || id === "features" ? 90 : 60;
      const adjustment = id === "workflow" ? 58 : id === "ide-demo" ? 24 : 0;
      return Math.max(0, Math.round(el.getBoundingClientRect().top + window.scrollY - offset + adjustment));
    };

    const updateSnapDebug = () => {
      const statsEl = document.getElementById("stats");
      setSnapDebug({
        scrollY: Math.round(window.scrollY),
        secondTop: statsEl ? Math.round(statsEl.getBoundingClientRect().top + window.scrollY) : 0,
        secondTarget: getTarget("stats"),
        workflowTarget: getTarget("workflow"),
        liveTarget: getTarget("ide-demo"),
        featuresTarget: getTarget("features"),
      });
    };

    updateSnapDebug();
    window.addEventListener("scroll", updateSnapDebug, { passive: true });
    window.addEventListener("resize", updateSnapDebug);

    return () => {
      window.removeEventListener("scroll", updateSnapDebug);
      window.removeEventListener("resize", updateSnapDebug);
    };
  }, []);

  const scrollToIdx = useCallback((idx: number) => {
    const clamped = Math.max(0, Math.min(SNAP_IDS.length - 1, idx));
    currentSectionRef.current = clamped;
    setCurrentSection(clamped);

    if (clamped === 0) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (clamped === 1) {
      window.scrollTo({ top: 609, behavior: "smooth" });
      return;
    }
    const id = SNAP_IDS[clamped];
    const el = document.getElementById(id);
    if (!el) return;
    // ide-demo, features: 30px 덜 스크롤 (섹션이 화면에 30px 더 아래에서 시작)
    const offset = (id === "ide-demo" || id === "features") ? 90 : 60;
    const adjustment = id === "workflow" ? 58 : id === "ide-demo" ? 24 : 0;
    const top = el.getBoundingClientRect().top + window.scrollY - offset + adjustment;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }, []);

  /* PPT-style wheel snap */
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (isScrollingRef.current) { e.preventDefault(); return; }
      if (Math.abs(e.deltaY) < 20) return;
      const dir = e.deltaY > 0 ? 1 : -1;
      const next = currentSectionRef.current + dir;
      if (next < 0 || next >= SNAP_IDS.length) return;
      e.preventDefault();
      isScrollingRef.current = true;
      scrollToIdx(next);
      setTimeout(() => { isScrollingRef.current = false; }, 900);
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, [scrollToIdx]);

  /* Keyboard arrow / PageDown */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!["ArrowDown", "ArrowUp", "PageDown", "PageUp"].includes(e.key)) return;
      e.preventDefault();
      if (isScrollingRef.current) return;
      const dir = e.key === "ArrowDown" || e.key === "PageDown" ? 1 : -1;
      const next = currentSectionRef.current + dir;
      if (next < 0 || next >= SNAP_IDS.length) return;
      isScrollingRef.current = true;
      scrollToIdx(next);
      setTimeout(() => { isScrollingRef.current = false; }, 900);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scrollToIdx]);

  const goToStep = (i: number) => {
    if (i === activeStep) return;
    setTransitioning(true);
    setTimeout(() => {
      setActiveStep(i);
      setTransitioning(false);
    }, 250);
  };

  const step = WORKFLOW[activeStep];
  const ideStepData = IDE_STEPS[ideStep];

  return (
    <div className="v3-root" data-v3-theme={themeTone}>
      {SHOW_SCROLL_DEBUG && (
        <aside className="v3-scroll-debug" aria-label="snap position debug">
          <span>scrollY {snapDebug.scrollY}px</span>
          <span>2nd top {snapDebug.secondTop}px</span>
          <span>2nd target {snapDebug.secondTarget}px</span>
          <span>workflow {snapDebug.workflowTarget}px</span>
          <span>live {snapDebug.liveTarget}px</span>
          <span>features {snapDebug.featuresTarget}px</span>
        </aside>
      )}
      {/* Section dot indicator */}
      <nav className="v3-section-dots" aria-label="섹션 이동">
        {SNAP_IDS.map((id, i) => (
          <button
            key={id}
            className={`v3-section-dot${i === currentSection ? " v3-section-dot--active" : ""}`}
            onClick={() => { isScrollingRef.current = true; scrollToIdx(i); setTimeout(() => { isScrollingRef.current = false; }, 900); }}
            aria-label={id}
          />
        ))}
      </nav>

      {/* ── Nav ── */}
      <nav className="v3-nav">
        <div className="v3-nav__inner">
          <button
            type="button"
            className="v3-nav__brand"
            onClick={() => { isScrollingRef.current = true; scrollToIdx(0); setTimeout(() => { isScrollingRef.current = false; }, 900); }}
            aria-label="맨 위로 이동"
          >
            <V3ThemeLogo height={30} />
          </button>
          <div className="v3-nav__links">
            <a href="#workflow" onClick={(e) => { e.preventDefault(); isScrollingRef.current = true; scrollToIdx(2); setTimeout(() => { isScrollingRef.current = false; }, 900); }}>워크플로</a>
            <a href="#ide-demo" onClick={(e) => { e.preventDefault(); isScrollingRef.current = true; scrollToIdx(3); setTimeout(() => { isScrollingRef.current = false; }, 900); }}>라이브 데모</a>
            <a href="#features" onClick={(e) => { e.preventDefault(); isScrollingRef.current = true; scrollToIdx(4); setTimeout(() => { isScrollingRef.current = false; }, 900); }}>핵심기능</a>
            <a href="#cta" onClick={(e) => { e.preventDefault(); isScrollingRef.current = true; scrollToIdx(5); setTimeout(() => { isScrollingRef.current = false; }, 900); }}>시작하기</a>
          </div>
          <Link href="/login" className="v3-nav__cta">
            로그인 →
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <div className="v3-hero-wrap" id="hero">
        <section className="v3-hero">
          {/* SVG grid bg */}
          <div className="v3-hero__bg" aria-hidden="true">
            <svg
              width="100%"
              height="100%"
              viewBox="0 0 1220 660"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              preserveAspectRatio="xMidYMid slice"
            >
              <defs>
                <linearGradient id="v3-mask" x1="100" y1="50" x2="950" y2="550" gradientUnits="userSpaceOnUse">
                  <stop stopColor="var(--v3-mint)" stopOpacity="0" />
                  <stop offset="1" stopColor="var(--v3-mint)" stopOpacity="0.8" />
                </linearGradient>
                <mask id="v3-grid-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="1220" height="660">
                  <rect x="0" y="0" width="1220" height="660" fill="url(#v3-mask)" />
                </mask>
                <linearGradient id="v3-glow-a" x1="1118" y1="-100" x2="1118" y2="1000" gradientUnits="userSpaceOnUse">
                  <stop stopColor="var(--v3-glow)" />
                  <stop offset="0.38" stopColor="var(--v3-mint)" />
                  <stop offset="0.58" stopColor="var(--v3-sage)" />
                  <stop offset="0.75" stopColor="var(--v3-teal)" />
                  <stop offset="1" stopColor="var(--v3-accent)" />
                </linearGradient>
                <linearGradient id="v3-glow-b" x1="1050" y1="-160" x2="1050" y2="950" gradientUnits="userSpaceOnUse">
                  <stop stopColor="var(--v3-glow)" />
                  <stop offset="0.38" stopColor="var(--v3-mint)" />
                  <stop offset="0.58" stopColor="var(--v3-sage)" />
                  <stop offset="0.75" stopColor="var(--v3-teal)" />
                  <stop offset="1" stopColor="var(--v3-accent)" />
                </linearGradient>
                <linearGradient id="v3-glow-c" x1="1230" y1="-240" x2="1230" y2="880" gradientUnits="userSpaceOnUse">
                  <stop stopColor="var(--v3-sage)" />
                  <stop offset="0.6" stopColor="var(--v3-teal)" />
                  <stop offset="1" stopColor="var(--v3-accent)" />
                </linearGradient>
                <filter id="v3-f1" x="100" y="-420" width="1900" height="1800" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                  <feGaussianBlur stdDeviation="150" />
                </filter>
                <filter id="v3-f2" x="-500" y="-1100" width="3100" height="2900" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                  <feGaussianBlur stdDeviation="440" />
                </filter>
                <filter id="v3-f3" x="380" y="-400" width="1580" height="1500" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                  <feGaussianBlur stdDeviation="75" />
                </filter>
                <clipPath id="v3-clip">
                  <rect width="1220" height="660" rx="20" />
                </clipPath>
              </defs>

              <g clipPath="url(#v3-clip)">
                <rect width="1220" height="660" fill="var(--v3-bg)" />
                <g mask="url(#v3-grid-mask)">
                  {[...Array(35)].map((_, i) =>
                    [9, 45, 81, 117, 153, 189, 225, 261, 297, 333, 369, 405, 441, 477, 513, 549, 585, 621, 657].map((y) => (
                      <rect
                        key={`${i}-${y}`}
                        x={-20.09 + i * 36}
                        y={y}
                        width="35.6"
                        height="35.6"
                        stroke="var(--v3-mint)"
                        strokeOpacity="0.09"
                        strokeWidth="0.4"
                        strokeDasharray="2 2"
                      />
                    ))
                  )}
                  {[
                    [699, 81], [195, 153], [1023, 153], [123, 225], [1095, 225],
                    [951, 297], [231, 333], [303, 405], [87, 405], [519, 405],
                    [771, 405], [591, 477],
                  ].map(([x, y]) => (
                    <rect key={`f${x}-${y}`} x={x} y={y} width="36" height="36" fill="var(--v3-sage)" fillOpacity="0.07" />
                  ))}
                </g>
                <g filter="url(#v3-f1)">
                  <path d="M1420 -70V-130H1740V1020H450V750C985 750 1420 320 1420 -70Z" fill="url(#v3-glow-a)" />
                </g>
                <g filter="url(#v3-f2)">
                  <path d="M1360 -130V-190H1680V960H390V700C920 700 1360 270 1360 -130Z" fill="url(#v3-glow-b)" fillOpacity="0.55" />
                </g>
                <g style={{ mixBlendMode: "lighten" }} filter="url(#v3-f3)">
                  <path d="M1540 -200V-260H1860V880H570V620C1105 620 1540 190 1540 -200Z" fill="url(#v3-glow-c)" />
                </g>
              </g>
              <rect x="0.5" y="0.5" width="1219" height="659" rx="19.5" stroke="var(--v3-mint)" strokeOpacity="0.06" />
            </svg>
          </div>

          <div className="v3-hero__content">
            <span className="v3-badge">
              <span className="v3-badge__dot" />
              SSAFY 14기 자율 프로젝트
            </span>
            <h1 className="v3-hero__title">
              AI 에이전트와 함께<br />
              실무 역량을 키우는<br />
              <span className="v3-hero__accent">코딩 워크스페이스</span>
            </h1>
            <p className="v3-hero__sub">
              실무 과제를 풀고, 에이전트 흐름을 기록하고,<br />
              AI 활용 역량을 피드백 리포트로 확인하세요.
            </p>
            <div className="v3-hero__actions">
              <Link href="/login" className="v3-btn v3-btn--primary">
                무료로 시작하기
              </Link>
              <a href="#workflow" className="v3-btn v3-btn--ghost">
                워크플로 보기
              </a>
            </div>
            <div className="v3-theme-switcher" aria-label="랜딩페이지 색상 테마 선택">
              {THEME_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`v3-theme-switcher__btn${themeTone === option.id ? " is-active" : ""}`}
                    onClick={() => updateThemeTone(option.id)}
                  data-tone={option.id}
                >
                  <span className="v3-theme-switcher__swatch" aria-hidden="true" />
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Floating preview — glass edges */}
        <div className="v3-preview-wrap">
          <div className="v3-preview">
            <div className="v3-glass-frame">
              <Image
                src="/problemsDIFF.png"
                alt="AIGround 워크스페이스"
                width={1160}
                height={700}
                className="v3-preview__img"
                priority
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats ── */}
      <section className="v3-stats-section" id="stats">
        <div className="v3-container">
          <div className="v3-stats">
            {STATS.map((s) => (
              <div key={s.label} className="v3-stat">
                <strong>{s.value}</strong>
                <span>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Workflow Demo ── */}
      <section className="v3-workflow" id="workflow">
        <div className="v3-container">
          <div className="v3-section__head">
            <p className="v3-section__label">실제 워크플로</p>
            <h2 className="v3-section__title">세션 시작부터 리포트까지<br />한 흐름으로</h2>
          </div>

          <div className="v3-wf">
            {/* Left: steps */}
            <div className="v3-wf__steps">
              {WORKFLOW.map((w, i) => (
                <button
                  key={w.step}
                  className={`v3-wf__step${i === activeStep ? " v3-wf__step--active" : ""}`}
                  onClick={() => goToStep(i)}
                >
                  <span className="v3-wf__step-num">{w.step}</span>
                  <span className="v3-wf__step-label">{w.label}</span>
                  {i === activeStep && <span className="v3-wf__step-tag">{w.tag}</span>}
                </button>
              ))}

              {/* Terminal command box */}
              <div className="v3-wf__terminal">
                <div className="v3-wf__terminal-bar">
                  <span className="v3-wf__terminal-title">aig-terminal</span>
                  <div className="v3-wf__terminal-controls" aria-hidden="true">
                    <span className="v3-wf__terminal-control v3-wf__terminal-control--minimize" />
                    <span className="v3-wf__terminal-control v3-wf__terminal-control--maximize" />
                    <span className="v3-wf__terminal-control v3-wf__terminal-control--close" />
                  </div>
                </div>
                <div className="v3-wf__terminal-body">
                  <div className="v3-wf__terminal-prompt">
                    <span className="v3-wf__t-user">user@aig</span>
                    <span className="v3-wf__t-sep">:</span>
                    <span className="v3-wf__t-path">~/workspace</span>
                    <span className="v3-wf__t-dollar">$ </span>
                  </div>
                  <div
                    className={`v3-wf__terminal-cmd${transitioning ? " v3-wf__terminal-cmd--out" : ""}`}
                  >
                    {step.cmd}
                  </div>
                  <div
                    className={`v3-wf__terminal-desc${transitioning ? " v3-wf__terminal-desc--out" : ""}`}
                  >
                    {step.desc}
                  </div>
                </div>
              </div>
            </div>

            {/* Right: screenshot */}
            <div className="v3-wf__display">
              {/* Step progress bar */}
              <div className="v3-wf__progress">
                {WORKFLOW.map((_, i) => (
                  <div
                    key={i}
                    className={`v3-wf__progress-dot${i === activeStep ? " v3-wf__progress-dot--active" : i < activeStep ? " v3-wf__progress-dot--done" : ""}`}
                    onClick={() => goToStep(i)}
                  />
                ))}
              </div>
              <div className="v3-wf__screen">
                <div className="v3-glass-frame v3-glass-frame--wf">
                  <Image
                    src={step.img}
                    alt={step.alt}
                    width={900}
                    height={560}
                    className={`v3-wf__img${transitioning ? " v3-wf__img--out" : ""}`}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── IDE Live Demo ── */}
      <section className="v3-ide-section" id="ide-demo">
        <div className="v3-container">
          <div className="v3-section__head v3-ide-section__head">
            <p className="v3-section__label">라이브 데모</p>
            <h2 className="v3-section__title v3-ide-section__title">실제 화면처럼 흐르는 워크플로</h2>
            <p className="v3-ide-section__sub">문제 풀이 화면에서 코드를 선택하고, 에이전트 모드로 질문을 보내고, 답변이 도착하는 순간까지.</p>
          </div>

          <div className={`v3-ide-wf v3-ide-wf--step-${ideStep}`}>
            {/* Left: IDE window */}
            <div className="v3-ide-wf__stage">
              <div className="v3-ide-wf__window">
                <div className="v3-ide-wf__window-bar">
                  <div className="v3-ide-wf__window-dots">
                    <span className="v3-dot v3-dot--red" />
                    <span className="v3-dot v3-dot--yellow" />
                    <span className="v3-dot v3-dot--green" />
                  </div>
                  <span className="v3-ide-wf__window-title">/dev/ide/session-e89y3kqx-mo6u209l</span>
                  <span className="v3-ide-wf__window-meta">Live IDE Session</span>
                </div>
                <div className="v3-ide-wf__canvas">
                  <Image
                    src="/problemsSession.png"
                    alt="실무 과제 풀이 세션"
                    fill
                    className="v3-ide-wf__image"
                    sizes="(max-width: 768px) 100vw, 65vw"
                  />
                  <div className="v3-ide-wf__code-focus" />
                  <div className="v3-ide-wf__cursor">
                    <span className="v3-ide-wf__cursor-tip">드래그 후 질문</span>
                  </div>
                  <div className="v3-ide-wf__mini-card">
                    <div className="v3-ide-wf__mini-card-head">
                      <span>변경 제안 미리보기</span>
                      <span className="v3-ide-wf__mini-card-badge">Diff</span>
                    </div>
                    <div className="v3-ide-wf__mini-card-preview">
                      <Image
                        src="/problemsDIFF.png"
                        alt="코드 diff"
                        fill
                        className="v3-ide-wf__mini-image"
                        sizes="220px"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Agent panel */}
            <div className="v3-ide-wf__agent">
              <div className="v3-ide-wf__agent-head">
                <div>
                  <p className="v3-ide-wf__agent-eyebrow">Agent Mode</p>
                  <h3>선택한 코드에 대해 바로 묻기</h3>
                </div>
                <span className="v3-ide-wf__status-chip">{ideStepData.label}</span>
              </div>

              <div className="v3-ide-wf__agent-body">
                <div className="v3-ide-wf__message v3-ide-wf__message--user">
                  <span className="v3-ide-wf__message-role">질문</span>
                  <p>{ideStepData.question}</p>
                </div>
                <div className={`v3-ide-wf__message v3-ide-wf__message--agent${ideStep < 2 ? " is-hidden" : ""}`}>
                  <span className="v3-ide-wf__message-role">에이전트</span>
                  {ideStep === 2 ? (
                    <div className="v3-ide-wf__typing"><span /><span /><span /></div>
                  ) : (
                    <p>{ideStepData.answer}</p>
                  )}
                </div>
                <div className={`v3-ide-wf__note${ideStep < 3 ? " is-hidden" : ""}`}>
                  <strong>수정 제안</strong>
                  <span>오른쪽 답변과 함께 diff 미리보기가 열려 바로 적용 여부를 판단할 수 있습니다.</span>
                </div>
              </div>

              <div className="v3-ide-wf__footer">
                <span className="v3-ide-wf__t-user">agent@aig</span>
                <span className="v3-ide-wf__t-sep">:</span>
                <span className="v3-ide-wf__t-path">selection</span>
                <span className="v3-ide-wf__t-dollar">$ </span>
                <span>{ideStepData.status}</span>
                <span style={{ opacity: ideCursor ? 1 : 0 }}>|</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Feature Cards ── */}
      <section className="v3-features" id="features">
        <div className="v3-container">
          <div className="v3-section__head">
            <p className="v3-section__label">핵심 기능</p>
            <h2 className="v3-section__title">과제부터 역량 평가까지<br />하나의 플랫폼에서</h2>
          </div>

          <div className="v3-feat-grid">
            {FEATURES.map((f) => (
              <div key={f.title} className="v3-feat-card">
                <div className="v3-feat-card__img-wrap">
                  <div className="v3-glass-frame v3-glass-frame--card">
                    <Image
                      src={f.img}
                      alt={f.title}
                      width={560}
                      height={340}
                      className="v3-feat-card__img"
                    />
                  </div>
                </div>
                <div className="v3-feat-card__body">
                  <span className="v3-feat-card__tag">{f.tag}</span>
                  <h3 className="v3-feat-card__title">{f.title}</h3>
                  <p className="v3-feat-card__desc">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="v3-cta" id="cta">
        <div className="v3-container v3-cta__inner">
          <h2 className="v3-cta__title">지금 바로 시작하세요</h2>
          <p className="v3-cta__sub">로그인 후 과제를 선택하고 AI와 함께 풀어보세요.</p>
          <Link href="/login" className="v3-btn v3-btn--primary v3-btn--lg">
            로그인하러 가기
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="v3-footer">
        <div className="v3-footer__inner">
          <div className="v3-footer__brand">
            <V3ThemeLogo height={28} />
            <p className="v3-footer__tagline">Built for solving real backend tasks with AI.</p>
            <p className="v3-footer__copy">
              AIGround는 실무 과제 풀이, 에이전트 워크플로, 실행 Trace, AI 활용 피드백을 하나의 흐름으로 연결하는
              AI 기반 개발 워크스페이스입니다.
            </p>
          </div>

          <div className="v3-footer__cols">
            <div className="v3-footer__col">
              <strong>Product</strong>
              <a href="#workflow">워크플로</a>
              <a href="#ide-demo">라이브 데모</a>
              <a href="#features">핵심 기능</a>
            </div>
            <div className="v3-footer__col">
              <strong>Start</strong>
              <Link href="/login">로그인</Link>
              <a href="#cta">시작하기</a>
            </div>
          </div>
        </div>

        <div className="v3-footer__bottom">
          <span>AI-Based Integrated Ground · SSAFY 14기 자율 프로젝트</span>
          <span>Build faster. Trace clearly. Review smarter.</span>
        </div>
      </footer>
    </div>
  );
}

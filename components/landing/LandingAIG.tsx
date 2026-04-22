"use client";

import Link from "next/link";
import {
  Sparkles,
  ArrowRight,
  PlayCircle,
  MessageSquare,
  Bot,
  LineChart,
  ChevronRight,
  FlaskConical,
  Code2,
  Activity,
  Upload,
  FileText
} from "lucide-react";

export function LandingAIG() {
  return (
    <div className="min-h-screen bg-white font-sans">
      {/* ────────────────── HERO SECTION (Dark) ────────────────── */}
      <section className="relative overflow-hidden bg-[#0F0F2E] text-white">
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
            <Link href="/dev2" className="flex items-center space-x-2 text-indigo-600 font-display font-bold text-lg group">
              <Sparkles size={20} strokeWidth={2} className="transition-transform group-hover:rotate-12" />
              <span>AIG</span>
            </Link>
            <div className="hidden md:flex items-center space-x-8 text-sm font-medium text-gray-700">
              <a href="#features" className="hover:text-indigo-600 transition-colors">기능</a>
              <a href="#workflow" className="hover:text-indigo-600 transition-colors">워크플로</a>
              <a href="#reports" className="hover:text-indigo-600 transition-colors">리포트</a>
              <Link href="/dev2/login" className="hover:text-indigo-600 transition-colors">로그인</Link>
            </div>
            <Link
              href="/dev2/signup"
              className="inline-flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-full transition-colors shadow-md"
            >
              <span>무료로 시작</span>
              <ArrowRight size={14} strokeWidth={2.4} />
            </Link>
          </nav>
        </div>

        {/* Hero content */}
        <div className="relative z-10 px-6 pt-24 pb-40 text-center max-w-4xl mx-auto animate-slide-up">
          <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-3.5 py-1.5 text-xs font-semibold text-indigo-100 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-300 animate-dot-pulse" />
            <span>SSAFY 14기 · D103 자율 프로젝트</span>
          </div>

          <h1 className="text-5xl md:text-6xl lg:text-7xl font-display font-bold tracking-tight leading-[1.1] mb-8">
            AI 에이전트와 함께
            <br />
            실무 역량을 키우는
            <br />
            <span className="bg-gradient-to-r from-indigo-300 via-teal-200 to-violet-300 text-gradient bg-gradient-animate">
              코딩 워크스페이스
            </span>
          </h1>

          <p className="text-lg md:text-xl text-indigo-200/90 max-w-2xl mx-auto leading-relaxed mb-10">
            실무 과제를 풀고, 에이전트 흐름을 기록하고,
            <br className="hidden md:block" />
            AI 활용 역량을 피드백 리포트로 확인하세요.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/dev2/signup"
              className="inline-flex items-center space-x-2 bg-white text-indigo-900 hover:bg-indigo-50 font-semibold px-6 py-3.5 rounded-full transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
            >
              <Sparkles size={18} strokeWidth={2.2} />
              <span>무료로 시작하기</span>
              <ArrowRight size={16} strokeWidth={2.4} />
            </Link>
            <a
              href="#features"
              className="inline-flex items-center space-x-2 bg-white/10 hover:bg-white/15 backdrop-blur-sm border border-white/20 text-white font-semibold px-6 py-3.5 rounded-full transition-colors"
            >
              <PlayCircle size={18} strokeWidth={2.2} />
              <span>데모 보기</span>
            </a>
          </div>
        </div>

        {/* Stats bar (inside hero, bottom overlay) */}
        <div className="relative z-10 px-6 pb-16">
          <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-0 bg-white/[0.07] backdrop-blur-xl border border-white/15 rounded-2xl overflow-hidden">
            {[
              { value: "5종", label: "실무 과제" },
              { value: "2개", label: "지원 언어" },
              { value: "3가지", label: "평가 기준" },
              { value: "SSAFY 14기", label: "자율 프로젝트" }
            ].map((s, i) => (
              <div
                key={s.label}
                className={`text-center py-6 px-4 ${
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
      <section id="features" className="relative bg-white py-28 overflow-hidden">
        <div className="absolute top-40 left-0 w-96 h-96 rounded-full bg-indigo-100/50 blur-3xl pointer-events-none" />
        <div className="absolute bottom-40 right-0 w-96 h-96 rounded-full bg-violet-100/50 blur-3xl pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-6">
          <div className="text-center mb-20">
            <div className="inline-flex items-center space-x-2 bg-indigo-50 border border-indigo-100 rounded-full px-3 py-1 text-xs font-semibold text-indigo-700 mb-6">
              <Sparkles size={12} strokeWidth={2.4} />
              <span>CORE FEATURES</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-display font-bold text-gray-900 tracking-tight mb-4">
              AI를 <span className="bg-gradient-to-r from-indigo-600 to-violet-600 text-gradient">어떻게 쓰느냐</span>를
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
                gradient: "from-indigo-500 to-indigo-600",
                tagColor: "text-indigo-600",
                ring: "group-hover:ring-indigo-200"
              },
              {
                icon: Bot,
                title: "Agent Mode",
                tag: "설계하는 능력",
                desc: "하네스를 설계하고 에이전트에게 과제를 위임합니다. 자율 실행된 에이전트의 Trace가 남습니다.",
                gradient: "from-violet-500 to-violet-600",
                tagColor: "text-violet-600",
                ring: "group-hover:ring-violet-200"
              },
              {
                icon: LineChart,
                title: "AI 피드백 리포트",
                tag: "객관적 평가",
                desc: "하네스 품질 · 실행 품질 · Trace 활용 3가지 기준으로 AI 활용 역량을 수치화합니다.",
                gradient: "from-teal-500 to-teal-600",
                tagColor: "text-teal-600",
                ring: "group-hover:ring-teal-200"
              }
            ].map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="group relative bg-white rounded-3xl border border-gray-100 p-8 hover:-translate-y-1 hover:shadow-2xl transition-all animate-slide-up"
                  style={{ animationFillMode: "both" }}
                >
                  <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br ${f.gradient} mb-6 shadow-lg shadow-indigo-500/20 ring-4 ring-transparent ${f.ring} transition-all`}>
                    <Icon size={26} strokeWidth={2} className="text-white" />
                  </div>
                  <div className={`inline-block text-[11px] font-mono font-semibold uppercase tracking-wider ${f.tagColor} mb-2`}>
                    {f.tag}
                  </div>
                  <h3 className="text-xl font-display font-bold text-gray-900 mb-3">{f.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{f.desc}</p>
                  <div className="mt-6 inline-flex items-center space-x-1 text-sm font-semibold text-indigo-600 opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all">
                    <span>자세히 보기</span>
                    <ChevronRight size={14} strokeWidth={2.4} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ────────────────── WORKFLOW (Horizontal, spacious) ────────────────── */}
      <section id="workflow" className="relative bg-gradient-to-b from-indigo-50/40 via-white to-white py-28">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-20">
            <div className="inline-flex items-center space-x-2 bg-white border border-indigo-100 rounded-full px-3 py-1 text-xs font-semibold text-indigo-700 mb-6 shadow-sm">
              <Activity size={12} strokeWidth={2.4} />
              <span>WORKFLOW</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-display font-bold text-gray-900 tracking-tight mb-4">
              학습부터 분석까지
              <br />
              <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-teal-600 text-gradient bg-gradient-animate">
                한 흐름으로
              </span>
            </h2>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto">
              과제 선택부터 피드백 리포트까지, 끊김 없는 5단계 워크플로우.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 stagger-children">
            {[
              { num: "01", title: "세션 시작", desc: "과제를 선택하고 워크스페이스를 생성합니다.", icon: FlaskConical, color: "from-indigo-500 to-indigo-600" },
              { num: "02", title: "코드 수정", desc: "코드를 작성하고 AI 제안을 받아 개선합니다.", icon: Code2, color: "from-indigo-500 to-violet-500" },
              { num: "03", title: "Trace 분석", desc: "실행 흐름을 추적하고 병목과 오류를 파악합니다.", icon: Activity, color: "from-violet-500 to-violet-600" },
              { num: "04", title: "제출", desc: "테스트를 통과하면 과제를 제출합니다.", icon: Upload, color: "from-violet-500 to-teal-500" },
              { num: "05", title: "리포트", desc: "AI 리포트로 피드백을 확인하고 다음 과제를 준비합니다.", icon: FileText, color: "from-teal-500 to-teal-600" }
            ].map((step) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.num}
                  className="relative bg-white rounded-2xl border border-gray-100 p-6 hover:-translate-y-1 hover:shadow-xl transition-all animate-slide-up group"
                  style={{ animationFillMode: "both" }}
                >
                  <div className="flex items-center justify-between mb-5">
                    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center text-white font-display font-bold text-sm shadow-lg`}>
                      {step.num}
                    </div>
                    <Icon size={20} strokeWidth={1.8} className="text-indigo-300 group-hover:text-indigo-500 transition-colors" />
                  </div>
                  <h3 className="text-base font-semibold text-gray-900 mb-2 leading-tight">{step.title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{step.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ────────────────── REPORT TEASER ────────────────── */}
      <section id="reports" className="relative bg-white py-28 overflow-hidden">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="animate-slide-up">
              <div className="inline-flex items-center space-x-2 bg-teal-50 border border-teal-100 rounded-full px-3 py-1 text-xs font-semibold text-teal-700 mb-6">
                <LineChart size={12} strokeWidth={2.4} />
                <span>FEEDBACK REPORT</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-display font-bold text-gray-900 tracking-tight leading-tight mb-6">
                내가 AI를
                <br />
                <span className="bg-gradient-to-r from-teal-600 to-indigo-600 text-gradient">
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
                className="inline-flex items-center space-x-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-semibold px-6 py-3 rounded-full transition-all shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:-translate-y-0.5"
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
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-lg">
                    <LineChart size={36} strokeWidth={1.5} />
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-gray-100">
                  {[
                    { label: "하네스 품질", score: 85, color: "from-indigo-500 to-indigo-600" },
                    { label: "실행 품질", score: 78, color: "from-violet-500 to-violet-600" },
                    { label: "Trace 활용", score: 84, color: "from-teal-500 to-teal-600" }
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium text-gray-700">{item.label}</span>
                        <span className="text-sm font-bold text-gray-900">{item.score}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full bg-gradient-to-r ${item.color} rounded-full`}
                          style={{ width: `${item.score}%` }}
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

      {/* ────────────────── CTA ────────────────── */}
      <section className="relative bg-[#0F0F2E] text-white py-28 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-[20%] w-96 h-96 rounded-full bg-violet-500/30 blur-3xl animate-blob-1" />
          <div className="absolute bottom-0 right-[15%] w-96 h-96 rounded-full bg-teal-400/30 blur-3xl animate-blob-2" />
          <div className="absolute inset-0 bg-grid-pattern opacity-[0.15]" />
        </div>
        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-4xl md:text-5xl font-display font-bold tracking-tight mb-6 leading-tight">
            AI 시대의 개발자 역량,
            <br />
            <span className="bg-gradient-to-r from-indigo-300 via-teal-200 to-violet-300 text-gradient bg-gradient-animate">
              지금 증명하세요
            </span>
          </h2>
          <p className="text-lg text-indigo-200/80 mb-10 leading-relaxed">
            로그인 후 과제를 선택하고 AI와 함께 풀어보세요.
          </p>
          <Link
            href="/dev2/signup"
            className="inline-flex items-center space-x-2 bg-white text-indigo-900 hover:bg-indigo-50 font-semibold px-8 py-4 rounded-full transition-all shadow-2xl hover:-translate-y-0.5"
          >
            <Sparkles size={18} strokeWidth={2.2} />
            <span>AIG 시작하기</span>
            <ArrowRight size={16} strokeWidth={2.4} />
          </Link>
        </div>
      </section>

      {/* ────────────────── FOOTER ────────────────── */}
      <footer className="bg-[#0A0A20] text-indigo-200/80 py-16 border-t border-white/10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between gap-10">
          <div>
            <Link href="/dev2" className="inline-flex items-center space-x-2 text-white font-display font-bold text-xl mb-4">
              <Sparkles size={22} strokeWidth={2} />
              <span>AIG</span>
            </Link>
            <p className="text-sm text-indigo-200/60 max-w-md leading-relaxed">
              AI-Based Integrated Ground · SSAFY 14기 D103 자율 프로젝트
              <br />
              AI와 함께 성장하는 개발자를 위한 코딩 워크스페이스.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-10 text-sm">
            <div>
              <h4 className="text-white font-semibold mb-3 uppercase text-xs tracking-wider">Product</h4>
              <ul className="space-y-2">
                <li><a href="#features" className="hover:text-white transition-colors">기능</a></li>
                <li><a href="#workflow" className="hover:text-white transition-colors">워크플로</a></li>
                <li><a href="#reports" className="hover:text-white transition-colors">리포트</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3 uppercase text-xs tracking-wider">Start</h4>
              <ul className="space-y-2">
                <li><Link href="/dev2/login" className="hover:text-white transition-colors">로그인</Link></li>
                <li><Link href="/dev2/signup" className="hover:text-white transition-colors">회원가입</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3 uppercase text-xs tracking-wider">Team</h4>
              <ul className="space-y-2">
                <li>D103 띠링띠링</li>
                <li className="text-indigo-200/50">SSAFY 14기</li>
              </ul>
            </div>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-6 mt-12 pt-6 border-t border-white/5 flex flex-wrap justify-between text-xs text-indigo-200/40">
          <span>© 2026 AIG · D103 띠링띠링</span>
          <span>Design the agent. Master the harness.</span>
        </div>
      </footer>
    </div>
  );
}

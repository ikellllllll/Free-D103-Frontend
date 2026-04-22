"use client";

import Link from "next/link";
import {
  Sparkles,
  Menu,
  Search,
  MessageSquare,
  FileText,
  FolderOpen,
  Rocket,
  Monitor,
  Shield,
  Lock,
  EyeOff,
  ArrowRight,
  Settings
} from "lucide-react";

export default function Dev2LandingPage() {
  return (
    <div className="min-h-screen bg-white font-sans selection:bg-indigo-200 selection:text-indigo-900">
      {/* ── Header ── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-indigo-600 font-display font-bold text-xl">
            <Sparkles size={24} strokeWidth={2} />
            <span>AIG</span>
          </div>
          <nav className="hidden md:flex items-center space-x-8 text-sm font-medium text-gray-600">
            <a href="#product" className="hover:text-indigo-600 transition-colors">Product</a>
            <a href="#features" className="hover:text-indigo-600 transition-colors">Features</a>
            <a href="#spaces" className="hover:text-indigo-600 transition-colors">Spaces</a>
            <a href="#privacy" className="hover:text-indigo-600 transition-colors">Privacy</a>
            <a href="#voices" className="hover:text-indigo-600 transition-colors">Voices</a>
          </nav>
          <div className="hidden md:flex items-center space-x-4">
            <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors">
              Sign in
            </Link>
            <Link href="/signup" className="bg-indigo-600 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-indigo-700 transition-colors">
              Get started
            </Link>
          </div>
          <button type="button" className="md:hidden text-gray-600" aria-label="메뉴">
            <Menu size={24} strokeWidth={2} />
          </button>
        </div>
      </header>

      <main>
        {/* ── Hero ── */}
        <section className="pt-32 pb-16 px-6 bg-gradient-to-b from-indigo-50 via-purple-50/50 to-white relative overflow-hidden" id="product">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-radial from-indigo-200/50 to-transparent blur-3xl -z-10" />
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-5xl md:text-7xl font-display font-bold text-gray-900 tracking-tight mb-6">
              Meet AIG.
              <br />
              <span className="text-gradient bg-gradient-to-r from-indigo-600 to-purple-600">
                당신의 AI 코딩 워크스페이스.
              </span>
            </h1>
            <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
              AIG는 실무 과제를 AI와 함께 풀고, 에이전트 흐름을 기록하며,
              <br />
              피드백 리포트로 AI 활용 역량을 확인하는 워크스페이스입니다.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/signup"
                className="flex items-center space-x-2 bg-gray-900 text-white px-8 py-4 rounded-full font-semibold hover:bg-gray-800 transition-colors shadow-lg"
              >
                <Sparkles size={20} strokeWidth={2} />
                <span>무료로 시작하기</span>
              </Link>
              <a
                href="#features"
                className="flex items-center space-x-2 bg-white text-gray-900 border border-gray-200 px-8 py-4 rounded-full font-semibold hover:bg-gray-50 transition-colors shadow-sm"
              >
                <span>데모 보기</span>
              </a>
            </div>
          </div>

          {/* IDE mockup */}
          <div className="relative w-full max-w-5xl mx-auto mt-16 rounded-2xl overflow-hidden mockup-shadow bg-white border border-gray-200">
            <div className="flex items-center px-4 py-3 bg-gray-50 border-b border-gray-200">
              <div className="flex space-x-2">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
              </div>
              <div className="mx-auto flex items-center space-x-2 bg-white px-4 py-1 rounded-md border border-gray-200 text-sm text-gray-500 shadow-sm w-1/2 justify-center">
                <Search size={14} strokeWidth={2} />
                <span>과제 검색 또는 AI에게 질문…</span>
              </div>
            </div>
            <div className="flex h-[400px] md:h-[500px]">
              <div className="hidden md:flex w-64 bg-gray-50 border-r border-gray-200 p-4 flex-col">
                <div className="flex items-center space-x-2 mb-6 text-indigo-600 font-semibold">
                  <Sparkles size={18} strokeWidth={2} />
                  <span>AIG Assistant</span>
                </div>
                <div className="space-y-1">
                  <div className="px-3 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium flex items-center space-x-2">
                    <MessageSquare size={16} strokeWidth={2} />
                    <span>Chat Mode</span>
                  </div>
                  <div className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium flex items-center space-x-2">
                    <FileText size={16} strokeWidth={2} />
                    <span>과제 브리프</span>
                  </div>
                  <div className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium flex items-center space-x-2">
                    <FolderOpen size={16} strokeWidth={2} />
                    <span>세션 파일</span>
                  </div>
                </div>
              </div>
              <div className="flex-1 bg-white p-6 md:p-8 overflow-hidden relative">
                <div className="max-w-2xl mx-auto">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Todo API 구현</h2>
                  <p className="text-gray-600 leading-relaxed mb-6">
                    Spring Boot 기반 Todo API를 구현하세요. JWT 인증, Pagination, 트랜잭션 처리까지 포함된 실무 시나리오입니다.
                  </p>
                  <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-xl border border-indigo-100 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-indigo-500 to-purple-500" />
                    <div className="flex items-start space-x-3">
                      <div className="p-2 bg-white rounded-lg shadow-sm text-indigo-600 shrink-0">
                        <Sparkles size={16} strokeWidth={2} />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900">AI Suggestion</h4>
                        <p className="text-sm text-gray-600 mt-1">
                          인증 로직에서 토큰 검증 순서가 바뀌어 있습니다. null 체크 후 prefix 검증 순서로 바꾸면 됩니다.
                        </p>
                        <div className="mt-3 flex space-x-2">
                          <button type="button" className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-md shadow-sm">
                            적용
                          </button>
                          <button type="button" className="px-3 py-1.5 bg-white text-gray-600 border border-gray-200 text-xs font-medium rounded-md shadow-sm">
                            닫기
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Quote ── */}
        <section className="bg-indigo-600 text-white py-24 relative overflow-hidden">
          <div className="w-full h-4 overflow-hidden text-white absolute top-0 left-0">
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="wavePatternTop" x="0" y="0" width="40" height="20" patternUnits="userSpaceOnUse">
                  <path d="M0 10 Q 10 0, 20 10 T 40 10" fill="none" stroke="currentColor" strokeWidth="2" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#wavePatternTop)" />
            </svg>
          </div>
          <div className="max-w-4xl mx-auto px-6 text-center mt-8">
            <h2 className="text-3xl md:text-5xl font-display font-bold leading-tight mb-8">
              &ldquo;AI 시대 개발자 역량 평가의 새로운 기준.&rdquo;
            </h2>
            <p className="text-xl text-indigo-200 font-medium mb-12 uppercase tracking-widest">
              SSAFY 14기 자율 프로젝트
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/signup"
                className="flex items-center space-x-2 bg-white text-indigo-600 px-8 py-4 rounded-full font-semibold hover:bg-indigo-50 transition-colors shadow-lg"
              >
                <Rocket size={20} strokeWidth={2} />
                <span>회원가입하고 시작</span>
              </Link>
              <a
                href="#features"
                className="flex items-center space-x-2 bg-indigo-700 text-white px-8 py-4 rounded-full font-semibold hover:bg-indigo-800 transition-colors shadow-lg border border-indigo-500"
              >
                <Monitor size={20} strokeWidth={2} />
                <span>기능 둘러보기</span>
              </a>
            </div>
          </div>
          <div className="mt-24 border-t border-indigo-500/50 py-4 overflow-hidden flex whitespace-nowrap">
            <div className="flex space-x-12 text-indigo-200 font-medium text-lg">
              <span>&ldquo;결과가 아닌 과정을 평가한다.&rdquo;</span>
              <span>&ldquo;하네스 엔지니어링 역량의 새 기준.&rdquo;</span>
              <span>&ldquo;AI 에이전트 설계 + 실행 트레이스 + 피드백.&rdquo;</span>
              <span>&ldquo;결과가 아닌 과정을 평가한다.&rdquo;</span>
              <span>&ldquo;하네스 엔지니어링 역량의 새 기준.&rdquo;</span>
              <span>&ldquo;AI 에이전트 설계 + 실행 트레이스 + 피드백.&rdquo;</span>
            </div>
          </div>
          <div className="w-full h-4 overflow-hidden text-white absolute bottom-0 left-0 transform rotate-180">
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="wavePatternBot" x="0" y="0" width="40" height="20" patternUnits="userSpaceOnUse">
                  <path d="M0 10 Q 10 0, 20 10 T 40 10" fill="none" stroke="currentColor" strokeWidth="2" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#wavePatternBot)" />
            </svg>
          </div>
        </section>

        {/* ── Bento Grid ── */}
        <section className="py-24 bg-gray-50" id="features">
          <div className="max-w-7xl mx-auto px-6 mt-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-display font-bold text-indigo-600 mb-4">
                한 플랫폼에서 실무 과제 끝까지.
              </h2>
              <p className="text-xl text-gray-600">문제 선택부터 피드백 리포트까지, 끊김 없는 워크플로우.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-[250px]">
              <div className="rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow md:col-span-1 md:row-span-2 relative group">
                <img
                  alt="과제 목록"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                  src="/problemsPage.png"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-6">
                  <span className="text-white font-medium text-lg">과제 목록</span>
                </div>
              </div>
              <div className="rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow md:col-span-2 md:row-span-1 relative group">
                <img
                  alt="코드 Diff 뷰"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                  src="/problemsDIFF.png"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-6">
                  <span className="text-white font-medium text-lg">AI 코드 수정 제안</span>
                </div>
              </div>
              <div className="rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow md:col-span-1 md:row-span-1 relative group">
                <img
                  alt="Trace 분석"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                  src="/Trace.png"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-6">
                  <span className="text-white font-medium text-lg">에이전트 Trace</span>
                </div>
              </div>
              <div className="rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow md:col-span-1 md:row-span-1 relative group">
                <img
                  alt="피드백 리포트"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                  src="/report.png"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-6">
                  <span className="text-white font-medium text-lg">AI 활용 피드백</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Spaces ── */}
        <section className="py-24 bg-white" id="spaces">
          <div className="max-w-7xl mx-auto px-6 text-center">
            <h2 className="text-4xl md:text-5xl font-display font-bold text-indigo-600 mb-4">
              상황별 워크스페이스.
            </h2>
            <p className="text-xl text-gray-600 mb-16">
              Chat Mode, Agent Mode, 하네스 설계 ─ 원하는 방식으로 AI와 일하세요.
            </p>
            <div className="relative max-w-5xl mx-auto rounded-2xl overflow-hidden mockup-shadow border border-gray-200 bg-white">
              <div className="flex h-[400px] md:h-[600px]">
                <div className="hidden md:flex w-64 bg-[#f8f9fa] border-r border-gray-200 flex-col">
                  <div className="p-4 flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500" />
                    <span className="font-semibold text-gray-800">내 워크스페이스</span>
                  </div>
                  <div className="px-3 py-2">
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-2">모드</div>
                    <div className="space-y-1 text-left">
                      <div className="px-3 py-2 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium flex items-center space-x-2">
                        <div className="w-3 h-3 rounded-full bg-indigo-500" />
                        <span>Chat Mode</span>
                      </div>
                      <div className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium flex items-center space-x-2">
                        <div className="w-3 h-3 rounded-full bg-pink-400" />
                        <span>Agent Mode</span>
                      </div>
                      <div className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium flex items-center space-x-2">
                        <div className="w-3 h-3 rounded-full bg-yellow-400" />
                        <span>하네스 설계</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex-1 bg-indigo-600 relative overflow-hidden flex items-center justify-center">
                  <div className="absolute inset-0 opacity-20">
                    <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                      <defs>
                        <pattern id="gridSpaces" width="40" height="40" patternUnits="userSpaceOnUse">
                          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1" />
                        </pattern>
                      </defs>
                      <rect width="100%" height="100%" fill="url(#gridSpaces)" />
                    </svg>
                  </div>
                  <div className="relative z-10 text-center text-white p-8">
                    <h1 className="text-4xl md:text-6xl font-display font-bold mb-4">Chat Mode</h1>
                    <p className="text-xl md:text-2xl font-light opacity-80">AI에게 질문하고, 수정 제안을 받고.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Customize ── */}
        <section className="py-24 bg-gray-50">
          <div className="max-w-7xl mx-auto px-6 text-center">
            <h2 className="text-4xl md:text-5xl font-display font-bold text-indigo-600 mb-4">
              취향대로 커스텀.
            </h2>
            <p className="text-xl text-gray-600 mb-16">
              11가지 컬러 테마 + 단축키 + 레이아웃. ⌘K 로 빠른 탐색.
            </p>
            <div className="relative max-w-4xl mx-auto">
              <div className="rounded-2xl overflow-hidden mockup-shadow border border-gray-200 bg-[#fbcfe8] p-8 flex h-[400px] md:h-[500px]">
                <div className="hidden md:block w-1/3 border-r border-pink-400/30 pr-8 text-left">
                  <h3 className="text-2xl font-display font-bold text-pink-900 mb-6">활동</h3>
                  <div className="space-y-4">
                    <div className="h-24 bg-white/50 rounded-xl backdrop-blur-sm p-4">
                      <div className="w-1/2 h-4 bg-pink-900/20 rounded mb-2" />
                      <div className="w-full h-3 bg-pink-900/10 rounded" />
                    </div>
                    <div className="h-24 bg-white/50 rounded-xl backdrop-blur-sm p-4">
                      <div className="w-2/3 h-4 bg-pink-900/20 rounded mb-2" />
                      <div className="w-full h-3 bg-pink-900/10 rounded" />
                    </div>
                  </div>
                </div>
                <div className="flex-1 md:pl-8 flex flex-col justify-center items-center md:items-start">
                  <div className="text-5xl md:text-6xl font-display text-pink-900/20 mb-8 font-bold">Palette</div>
                  <div className="flex space-x-4">
                    <div className="w-24 h-32 md:w-32 md:h-40 bg-white rounded-xl shadow-sm border border-pink-200 transform -rotate-6" />
                    <div className="w-24 h-32 md:w-32 md:h-40 bg-white rounded-xl shadow-sm border border-pink-200 transform rotate-3" />
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-8 right-4 md:-bottom-12 md:-right-12 w-64 bg-white/90 backdrop-blur-xl p-6 rounded-3xl mockup-shadow border border-white">
                <div className="flex justify-between items-center mb-6 text-gray-400">
                  <Sparkles size={16} strokeWidth={2} />
                  <Settings size={16} strokeWidth={2} />
                </div>
                <div className="flex justify-between mb-6">
                  <div className="w-6 h-6 rounded-full bg-red-400 cursor-pointer hover:scale-110 transition-transform" />
                  <div className="w-6 h-6 rounded-full bg-orange-400 cursor-pointer hover:scale-110 transition-transform" />
                  <div className="w-6 h-6 rounded-full bg-yellow-400 cursor-pointer hover:scale-110 transition-transform" />
                  <div className="w-6 h-6 rounded-full bg-green-400 cursor-pointer hover:scale-110 transition-transform" />
                  <div className="w-6 h-6 rounded-full bg-blue-400 cursor-pointer hover:scale-110 transition-transform" />
                  <div className="w-6 h-6 rounded-full bg-pink-400 cursor-pointer hover:scale-110 transition-transform ring-2 ring-offset-2 ring-pink-400" />
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="w-1/2 h-full bg-gray-300 rounded-full" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Privacy ── */}
        <section className="py-24 bg-white text-center" id="privacy">
          <div className="max-w-3xl mx-auto px-6">
            <h2 className="text-4xl md:text-5xl font-display font-bold text-indigo-600 mb-4">
              실무 중심 학습.
            </h2>
            <p className="text-xl text-gray-600 mb-12">
              AIG는 정답 유출이 아닌 과정 학습을 평가합니다. 제출물과 Trace는 본인만 볼 수 있습니다.
            </p>
            <div className="flex justify-center space-x-8 md:space-x-16 text-indigo-600 mb-12">
              <div className="flex flex-col items-center">
                <Shield size={48} strokeWidth={1.5} className="mb-4" />
                <span className="text-sm font-medium text-gray-600">암호화된 저장</span>
              </div>
              <div className="flex flex-col items-center">
                <Lock size={48} strokeWidth={1.5} className="mb-4" />
                <span className="text-sm font-medium text-gray-600">격리된 실행 환경</span>
              </div>
              <div className="flex flex-col items-center">
                <EyeOff size={48} strokeWidth={1.5} className="mb-4" />
                <span className="text-sm font-medium text-gray-600">개인 데이터 비공개</span>
              </div>
            </div>
            <a href="#privacy" className="inline-flex items-center space-x-2 text-indigo-600 font-semibold hover:text-indigo-700">
              <span>AIG의 데이터 정책 자세히 보기</span>
              <ArrowRight size={16} strokeWidth={2} />
            </a>
          </div>
        </section>

        {/* ── Voices ── */}
        <section className="py-24 bg-[#fef08a]/30 relative" id="voices">
          <div className="w-full h-4 overflow-hidden text-indigo-600 absolute top-0 left-0">
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="wavePatternVoices" x="0" y="0" width="40" height="20" patternUnits="userSpaceOnUse">
                  <path d="M0 10 Q 10 0, 20 10 T 40 10" fill="none" stroke="currentColor" strokeWidth="2" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#wavePatternVoices)" />
            </svg>
          </div>
          <div className="max-w-7xl mx-auto px-6 mt-12">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { quote: "하네스 설계의 개념이 제대로 잡혔어요.", user: "@backend_lee" },
                { quote: "Trace 보면서 내 프롬프트를 되돌아봤어요.", user: "@ai_builder" },
                { quote: "실무 과제가 진짜 면접 때 나옴 ㅋㅋ", user: "@interview_pass" },
                { quote: "드디어 AI 허용하는 코딩테스트.", user: "@new_gen_dev" }
              ].map((v) => (
                <div key={v.user} className="bg-white p-8 rounded-2xl shadow-sm border border-indigo-100 flex flex-col justify-between">
                  <p className="text-xl font-display font-bold text-indigo-600 mb-6 leading-tight">
                    &ldquo;{v.quote}&rdquo;
                  </p>
                  <div className="inline-block px-3 py-1 border border-indigo-200 text-indigo-600 text-sm font-semibold rounded-full self-start">
                    {v.user}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="bg-indigo-600 text-white py-24 relative overflow-hidden text-center">
          <div className="w-full h-4 overflow-hidden text-white absolute top-0 left-0">
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="wavePatternCta" x="0" y="0" width="40" height="20" patternUnits="userSpaceOnUse">
                  <path d="M0 10 Q 10 0, 20 10 T 40 10" fill="none" stroke="currentColor" strokeWidth="2" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#wavePatternCta)" />
            </svg>
          </div>
          <div className="max-w-3xl mx-auto px-6 mt-12">
            <h2 className="text-4xl md:text-5xl font-display font-bold mb-8">
              AI 시대의 개발자 역량, 지금 시작하세요.
            </h2>
            <Link
              href="/signup"
              className="flex items-center space-x-2 bg-white text-indigo-600 px-8 py-4 rounded-full font-semibold hover:bg-indigo-50 transition-colors shadow-lg mx-auto w-fit"
            >
              <Sparkles size={20} strokeWidth={2} />
              <span>AIG 시작하기</span>
            </Link>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="bg-indigo-700 text-indigo-200 py-16 border-t border-indigo-500/30">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between">
          <div className="mb-12 md:mb-0">
            <div className="flex items-center space-x-2 text-white font-display font-bold text-2xl mb-6">
              <Sparkles size={24} strokeWidth={2} />
              <span>AIG</span>
            </div>
            <p className="text-sm max-w-md">AI-Based Integrated Ground · SSAFY 14기 자율 프로젝트</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-12">
            <div>
              <h4 className="text-white font-semibold mb-4 uppercase text-sm tracking-wider">Product</h4>
              <ul className="space-y-3">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#spaces" className="hover:text-white transition-colors">Spaces</a></li>
                <li><Link href="/signup" className="hover:text-white transition-colors">시작하기</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4 uppercase text-sm tracking-wider">Resources</h4>
              <ul className="space-y-3">
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Docs</a></li>
                <li><a href="#" className="hover:text-white transition-colors">GitHub</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4 uppercase text-sm tracking-wider">Team</h4>
              <ul className="space-y-3">
                <li><a href="#" className="hover:text-white transition-colors">D103 띠링띠링</a></li>
                <li><a href="#" className="hover:text-white transition-colors">About</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

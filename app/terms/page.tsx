import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Shield, FileText, AlertTriangle } from "lucide-react";

export default function TermsPage() {
  const updatedAt = "2026년 4월 22일";

  return (
    <div className="relative min-h-screen bg-[#0F0F2E] text-white font-sans overflow-hidden">
      {/* Background grid */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.1]" />
      </div>

      {/* Header */}
      <header className="relative z-10 px-6 py-5 flex items-center justify-between max-w-5xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center space-x-2 text-white font-display font-bold text-xl group"
        >
          <Image src="/brand/favicon.png" alt="AIG" width={28} height={28} className="rounded-lg object-cover" />
          <span>AIG</span>
        </Link>
        <Link
          href="/signup"
          className="inline-flex items-center space-x-1.5 text-sm text-indigo-200/80 hover:text-white transition-colors"
        >
          <ArrowLeft size={14} />
          <span>회원가입으로</span>
        </Link>
      </header>

      {/* Content */}
      <main className="relative z-10 max-w-3xl mx-auto px-6 pb-24 pt-8">
        {/* Hero */}
        <div className="text-center mb-12 animate-slide-up">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-semibold text-indigo-200 mb-4">
            <FileText size={12} strokeWidth={2.4} />
            <span>LEGAL</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight mb-3">
            이용약관 · 개인정보 처리방침
          </h1>
          <p className="text-sm text-indigo-200/70">최종 업데이트: {updatedAt}</p>
        </div>

        {/* Notice banner */}
        <div
          className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 mb-10 flex items-start space-x-3 animate-slide-up"
          style={{ animationDelay: "0.05s", animationFillMode: "both" }}
        >
          <AlertTriangle size={18} className="text-amber-300 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-100 leading-relaxed">
            <strong className="block mb-1 text-amber-50">프로토타입 고지</strong>
            AIG는 SSAFY 14기 D103 팀의 <span className="font-semibold">자율 프로젝트 결과물</span>로,
            교육/시연 목적의 프로토타입입니다. 법적 구속력이 있는 상용 서비스가 아니며, 실제 개인정보 저장·처리는 최소한으로만 이루어집니다.
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-10">
          <Section icon={FileText} title="1. 서비스 소개" color="#A5B4FC">
            <p>
              AIG (AI-based Integrated Ground)는 개발자가 AI 에이전트와 함께 실무 과제를 해결하고,
              에이전트 실행 흐름(Trace)을 기록하며, AI 활용 역량을 피드백 리포트로 확인할 수 있는 교육용 워크스페이스입니다.
            </p>
            <p>본 서비스는 다음 기능을 제공합니다.</p>
            <ul>
              <li>실무 백엔드 과제 제공 (Spring Boot · Django 기반)</li>
              <li>Chat Mode / Agent Mode로 AI와 협업</li>
              <li>에이전트 실행 Trace 저장 및 조회</li>
              <li>하네스 품질 · 실행 품질 · Trace 활용도 기반 피드백 리포트</li>
            </ul>
          </Section>

          <Section icon={Shield} title="2. 수집 및 이용하는 정보" color="#99F6E4">
            <p>AIG는 서비스 제공을 위해 최소한의 정보만 수집합니다.</p>
            <ul>
              <li><strong>계정 정보</strong>: 이메일, 닉네임, 비밀번호 해시</li>
              <li><strong>학습 데이터</strong>: 과제 풀이 코드, AI 대화 내역, 실행 Trace</li>
              <li><strong>BYOK 키</strong>: 본인 API 키 (브라우저 로컬 스토리지에만 저장, 서버 전송 없음)</li>
            </ul>
            <p>
              위 정보는 AIG의 과제 분석 · 피드백 생성에만 사용되며, 제3자에게 공유하거나
              마케팅 목적으로 활용하지 않습니다.
            </p>
          </Section>

          <Section icon={Shield} title="3. 정보 보관 및 파기" color="#C4B5FD">
            <p>
              수집된 데이터는 AIG 서비스 종료 시점 또는 회원 탈퇴 요청 시 파기됩니다.
              프로토타입 특성상 수시로 초기화될 수 있으며, 사용자가 업로드한 데이터의 영구 보존을 보장하지 않습니다.
            </p>
            <p>
              암호화된 저장 + 격리된 실행 환경 (Docker) 을 통해 데이터를 안전하게 관리하기 위해 노력합니다.
            </p>
          </Section>

          <Section icon={FileText} title="4. 이용자 책임" color="#FCD34D">
            <p>이용자는 서비스 이용 시 다음 사항을 준수해야 합니다.</p>
            <ul>
              <li>타인의 계정이나 과제 풀이 결과를 무단으로 사용하지 않습니다.</li>
              <li>AIG 인프라에 악의적 요청(DoS, 크롤링, 스크래핑 등)을 가하지 않습니다.</li>
              <li>AI 모델의 한계를 인지하고, 생성된 코드를 그대로 신뢰하지 않습니다.</li>
              <li>BYOK 사용 시 API 키 노출에 본인이 책임집니다.</li>
            </ul>
          </Section>

          <Section icon={AlertTriangle} title="5. 책임 제한" color="#FCA5A5">
            <p>
              AIG는 교육용 프로토타입으로, 서비스 이용 중 발생한 데이터 손실 · 학습 오차 · 시간 지연에 대해
              법적 책임을 지지 않습니다. 상용 서비스 수준의 SLA를 보장하지 않으며, 예고 없이 기능이 추가/제거될 수 있습니다.
            </p>
          </Section>

          <Section icon={Shield} title="6. 문의" color="#99F6E4">
            <p>
              약관 관련 문의사항은 D103 팀 담당자에게 개별적으로 전달해 주세요.
              (SSAFY 14기 자율 프로젝트 과제 평가 기간 동안만 운영됩니다.)
            </p>
          </Section>
        </div>

        {/* Footer CTA */}
        <div className="mt-16 pt-10 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-indigo-200/60">
          <span>© 2026 AIG · SSAFY 14기 D103 띠링띠링</span>
          <div className="flex items-center space-x-5">
            <Link href="/" className="hover:text-white transition-colors">홈으로</Link>
            <Link href="/signup" className="hover:text-white transition-colors">회원가입</Link>
            <Link href="/login" className="hover:text-white transition-colors">로그인</Link>
          </div>
        </div>
      </main>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  color,
  children
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  title: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-6 md:p-7 animate-slide-up" style={{ animationFillMode: "both" }}>
      <div className="flex items-center space-x-3 mb-4">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${color}20`, border: `1px solid ${color}40` }}
        >
          <Icon size={16} strokeWidth={2} className="text-white" />
        </div>
        <h2 className="text-lg md:text-xl font-display font-bold text-white">{title}</h2>
      </div>
      <div className="text-sm md:text-[15px] text-indigo-100/80 leading-relaxed space-y-3 [&_p]:m-0 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1.5 [&_strong]:text-white">
        {children}
      </div>
    </section>
  );
}

"use client";

import Link from "next/link";
import { type ReactNode } from "react";

import { AuthHero } from "@/components/auth/AuthHero";
import { useRouteScope } from "@/components/routing/RouteScopeProvider";

const MODE_CONFIG = {
  login: {
    heroDescription:
      "과제 요구사항 확인, IDE 작업, 제출 기록, 피드백 리포트까지 한 흐름으로 이어지는 AIG 워크스페이스입니다.",
    sectionLabel: "작업 시작",
    heading: "기존 세션 이어서 시작",
    description: "이전 실습 기록과 제출 흐름을 이어서 확인할 수 있습니다.",
    footerText: "아직 계정이 없나요?",
    footerHref: "/signup",
    footerAction: "회원가입"
  },
  signup: {
    heroDescription:
      "세션, Trace, 제출 리포트를 계정 단위로 이어서 확인할 수 있는 AIG 작업 공간입니다.",
    sectionLabel: "계정 생성",
    heading: "새 작업 계정 만들기",
    description: "실습 기록, 세션 상태, 제출 리포트를 관리할 계정을 생성합니다.",
    footerText: "이미 계정이 있나요?",
    footerHref: "/login",
    footerAction: "로그인"
  }
} as const;

type AuthMode = keyof typeof MODE_CONFIG;

function getHeroTitle(mode: AuthMode) {
  if (mode === "signup") {
    return (
      <>
        풀이 기록이 쌓이는 개인 <span className="auth-title-accent">워크스페이스</span>
      </>
    );
  }

  return (
    <>
      과제 풀이를 바로 이어갈 수 있는 <span className="auth-title-accent">작업 공간</span>
    </>
  );
}

export function AuthLayoutShell({ children }: { children: ReactNode }) {
  const { withPrefix, currentPath } = useRouteScope();
  const mode: AuthMode = currentPath.includes("/signup") ? "signup" : "login";
  const cfg = MODE_CONFIG[mode];

  return (
    <>
      <AuthHero key={mode} title={getHeroTitle(mode)} description={cfg.heroDescription} />

      <section className="auth-form-panel" data-auth-mode={mode}>
        <div className="auth-form-panel__tabs" data-auth-mode={mode}>
          <span className="auth-form-panel__tab-indicator" aria-hidden />
          <Link
            href={withPrefix("/login")}
            className={`auth-form-panel__tab${mode === "login" ? " auth-form-panel__tab--active" : ""}`}
          >
            로그인
          </Link>
          <Link
            href={withPrefix("/signup")}
            className={`auth-form-panel__tab${mode === "signup" ? " auth-form-panel__tab--active" : ""}`}
          >
            회원가입
          </Link>
        </div>

        <div key={mode} className="auth-form-panel__content" data-auth-mode={mode}>
          <div className="stack-24">
            <div className="auth-form-panel__intro">
              <span className="eyebrow">{cfg.sectionLabel}</span>
              <h1>{cfg.heading}</h1>
              <p className="muted-copy">{cfg.description}</p>
            </div>
            {children}
          </div>
        </div>

        <p className="auth-form-panel__foot">
          {cfg.footerText}{" "}
          <Link href={withPrefix(cfg.footerHref)}>{cfg.footerAction}</Link>
        </p>
      </section>
    </>
  );
}

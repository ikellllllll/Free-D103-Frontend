"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent, type MouseEvent as ReactMouseEvent } from "react";

import { useRouteScope } from "@/components/routing/RouteScopeProvider";
import { mockApi } from "@/lib/api/mockApi";
import { useAuthStore } from "@/store/authStore";
import { useUiStore } from "@/store/uiStore";

const BUILD_ID = "AIG-v3.2.0";

export default function DevLoginPage() {
  const router = useRouter();
  const { withPrefix } = useRouteScope();
  const signIn = useAuthStore((state) => state.signIn);
  const addToast = useUiStore((state) => state.addToast);

  const [email, setEmail] = useState("user@email.com");
  const [password, setPassword] = useState("password");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [clock, setClock] = useState<string>("--:--:--");

  const shellRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  // Live clock for the status pill
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      const ss = String(d.getSeconds()).padStart(2, "0");
      setClock(`${hh}:${mm}:${ss}`);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  // Magnetic cursor glow — updates --mx / --my on the shell
  const handleMouseMove = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    const el = shellRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const mx = ((event.clientX - rect.left) / rect.width) * 100;
    const my = ((event.clientY - rect.top) / rect.height) * 100;
    el.style.setProperty("--pvxl-mx", `${mx}%`);
    el.style.setProperty("--pvxl-my", `${my}%`);
  }, []);

  // Subtle 3D tilt on the card
  const handleCardMove = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    const rx = (0.5 - y) * 4; // degrees
    const ry = (x - 0.5) * 6;
    el.style.setProperty("--pvxl-rx", `${rx}deg`);
    el.style.setProperty("--pvxl-ry", `${ry}deg`);
  }, []);

  const resetCardTilt = useCallback(() => {
    const el = cardRef.current;
    if (!el) return;
    el.style.setProperty("--pvxl-rx", `0deg`);
    el.style.setProperty("--pvxl-ry", `0deg`);
  }, []);

  const triggerShake = useCallback(() => {
    setShake(false);
    requestAnimationFrame(() => setShake(true));
    window.setTimeout(() => setShake(false), 600);
  }, []);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const user = await mockApi.login({ email, password });
      signIn(user);
      addToast("로그인되었습니다.", "success");
      router.push(withPrefix("/problems"));
    } catch (error) {
      triggerShake();
      addToast(error instanceof Error ? error.message : "로그인에 실패했습니다.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void handleLogin();
  };

  return (
    <div ref={shellRef} className="pvxl-shell" onMouseMove={handleMouseMove}>
      {/* Aurora background */}
      <div className="pvxl-aurora" aria-hidden>
        <div className="pvxl-aurora__blob pvxl-aurora__blob--1" />
        <div className="pvxl-aurora__blob pvxl-aurora__blob--2" />
        <div className="pvxl-aurora__blob pvxl-aurora__blob--3" />
        <div className="pvxl-aurora__grid" />
        <div className="pvxl-aurora__spot" />
      </div>

      {/* Top nav */}
      <header className="pvxl-nav">
        <Link href={withPrefix("/")} className="pvxl-nav__brand">
          <span className="pvxl-nav__mark">A</span>
          <span className="pvxl-nav__word">AIGround</span>
        </Link>

        <div className="pvxl-nav__status" aria-live="polite">
          <span className="pvxl-nav__status-dot" />
          <span className="pvxl-nav__status-label">모든 시스템 정상</span>
          <span className="pvxl-nav__status-sep" aria-hidden>·</span>
          <span className="pvxl-nav__status-clock">{clock}</span>
        </div>

        <Link href={withPrefix("/signup")} className="pvxl-nav__cta">
          회원가입
        </Link>
      </header>

      {/* Stage */}
      <main className="pvxl-stage">
        <section className="pvxl-brand">
          <span className="pvxl-brand__eyebrow">
            <span className="pvxl-brand__eyebrow-dot" /> Session · dev
          </span>
          <h1 className="pvxl-brand__title">
            Ground your
            <br />
            <span className="pvxl-brand__title-accent">AI instincts.</span>
          </h1>
          <p className="pvxl-brand__sub">
            다시 로그인하고 워크숍을 이어가세요.
            <br />새로운 문제를 열고, 변형을 바로 배포해 보세요.
          </p>

          <ul className="pvxl-brand__stats" aria-hidden>
            <li>
              <strong>120+</strong>
              <span>문제</span>
            </li>
            <li>
              <strong>24/7</strong>
              <span>워크숍</span>
            </li>
            <li>
              <strong>∞</strong>
              <span>반복 학습</span>
            </li>
          </ul>

          <div className="pvxl-brand__footer">
            <code className="pvxl-brand__build">{BUILD_ID}</code>
          </div>
        </section>

        <section
          ref={cardRef}
          className={`pvxl-card ${shake ? "pvxl-card--shake" : ""}`}
          onMouseMove={handleCardMove}
          onMouseLeave={resetCardTilt}
        >
          <div className="pvxl-card__glow" aria-hidden />
          <div className="pvxl-card__sheen" aria-hidden />

          <div className="pvxl-card__head">
            <h2 className="pvxl-card__title">다시 오신 것을 환영합니다</h2>
            <p className="pvxl-card__sub">
              워크스페이스 계정으로 계속 진행해 주세요.
            </p>
          </div>

          {/* Social */}
          <button type="button" className="pvxl-social">
            <Image
              src="/icons8-github-로고.svg"
              alt=""
              width={18}
              height={18}
              aria-hidden
              className="pvxl-social__icon"
            />
            <span>GitHub으로 계속하기</span>
            <span className="pvxl-social__arrow" aria-hidden>→</span>
          </button>

          <div className="pvxl-divider" role="separator">
            <span>또는 이메일로 로그인</span>
          </div>

          <form className="pvxl-form" onSubmit={handleSubmit} noValidate>
            <div className="pvxl-field">
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder=" "
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="pvxl-field__input"
                required
              />
              <label htmlFor="login-email" className="pvxl-field__label">
                이메일
              </label>
              <span className="pvxl-field__ring" aria-hidden />
            </div>

            <div className="pvxl-field">
              <input
                id="login-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder=" "
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="pvxl-field__input pvxl-field__input--with-action"
                required
              />
              <label htmlFor="login-password" className="pvxl-field__label">
                비밀번호
              </label>
              <button
                type="button"
                className="pvxl-field__peek"
                aria-pressed={showPassword}
                aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                onClick={() => setShowPassword((prev) => !prev)}
              >
                {showPassword ? "숨기기" : "보기"}
              </button>
              <span className="pvxl-field__ring" aria-hidden />
            </div>

            <div className="pvxl-row">
              <label className="pvxl-check">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                />
                <span className="pvxl-check__box" aria-hidden>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M1.5 5.2L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="pvxl-check__label">30일 동안 로그인 유지</span>
              </label>

              <Link href={withPrefix("/forgot")} className="pvxl-link">
                비밀번호를 잊으셨나요?
              </Link>
            </div>

            <button
              type="submit"
              className="pvxl-submit"
              disabled={loading}
              data-loading={loading ? "true" : "false"}
            >
              <span className="pvxl-submit__label">
                {loading ? "로그인 중" : "로그인"}
              </span>
              <span className="pvxl-submit__arrow" aria-hidden>
                {loading ? (
                  <span className="pvxl-spinner" />
                ) : (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M1 7h12M8 2l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
            </button>
          </form>

          {/* Alt auth */}
          <div className="pvxl-alt">
            <button type="button" className="pvxl-alt__btn" disabled title="출시 예정">
              <span className="pvxl-alt__kbd">⌘K</span>
              Passkey 로그인
            </button>
            <button type="button" className="pvxl-alt__btn" disabled title="출시 예정">
              <span className="pvxl-alt__kbd">@</span>
              매직 링크
            </button>
          </div>

          <p className="pvxl-card__foot">
            아직 계정이 없으신가요?{" "}
            <Link href={withPrefix("/signup")} className="pvxl-link pvxl-link--strong">
              계정 만들기
            </Link>
          </p>
        </section>
      </main>

      {/* Legal */}
      <footer className="pvxl-legal">
        계속 진행하면 <Link href="#">이용약관</Link> 및{" "}
        <Link href="#">개인정보처리방침</Link>에 동의하는 것으로 간주됩니다.
      </footer>
    </div>
  );
}

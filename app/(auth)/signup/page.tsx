"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AuthHero } from "@/components/auth/AuthHero";
import { mockApi } from "@/lib/api/mockApi";
import { useAuthStore } from "@/store/authStore";
import { useUiStore } from "@/store/uiStore";

export default function SignupPage() {
  const router = useRouter();
  const signIn = useAuthStore((state) => state.signIn);
  const addToast = useUiStore((state) => state.addToast);
  const [name, setName] = useState("홍길동");
  const [email, setEmail] = useState("new-user@email.com");
  const [password, setPassword] = useState("password");
  const [confirmPassword, setConfirmPassword] = useState("password");
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    if (password !== confirmPassword) {
      addToast("비밀번호가 일치하지 않습니다.", "warning");
      return;
    }

    setLoading(true);
    try {
      const user = await mockApi.signup({ name, email, password });
      signIn(user);
      addToast("계정이 생성되었습니다.", "success");
      router.push("/problems");
    } catch (error) {
      addToast(error instanceof Error ? error.message : "회원가입에 실패했습니다.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <AuthHero
        title="실습 기록이 남는 개발 워크스페이스"
        description="세션, Trace, 제출 리포트를 계정 단위로 이어서 확인할 수 있는 AIG 작업 공간입니다."
      />

      <section className="auth-form-panel">
        <div className="auth-form-panel__tabs">
          <Link href="/login" className="auth-form-panel__tab">
            로그인
          </Link>
          <span className="auth-form-panel__tab auth-form-panel__tab--active">회원가입</span>
        </div>

        <div className="stack-24">
          <div>
            <span className="eyebrow">계정 생성</span>
            <h1>새 작업 계정 만들기</h1>
            <p className="muted-copy">실습 기록, 세션 상태, 제출 리포트를 저장할 계정을 생성합니다.</p>
          </div>

          <div className="stack-16">
            <label className="field">
              <span>이름</span>
              <input className="input" value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label className="field">
              <span>이메일</span>
              <input className="input" value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label className="field">
              <span>비밀번호</span>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <label className="field">
              <span>비밀번호 확인</span>
              <input
                className="input"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </label>
          </div>

          <button className="button button--primary" onClick={handleSignup} disabled={loading}>
            {loading ? "생성 중..." : "계정 만들기"}
          </button>
        </div>

        <p className="auth-form-panel__foot">
          이미 계정이 있나요? <Link href="/login">로그인</Link>
        </p>
      </section>
    </>
  );
}

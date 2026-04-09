"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AuthHero } from "@/components/auth/AuthHero";
import { mockApi } from "@/lib/api/mockApi";
import { useAuthStore } from "@/store/authStore";
import { useUiStore } from "@/store/uiStore";

export default function LoginPage() {
  const router = useRouter();
  const signIn = useAuthStore((state) => state.signIn);
  const addToast = useUiStore((state) => state.addToast);
  const [email, setEmail] = useState("user@email.com");
  const [password, setPassword] = useState("password");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const user = await mockApi.login({ email, password });
      signIn(user);
      addToast("로그인되었습니다.", "success");
      router.push("/problems");
    } catch (error) {
      addToast(error instanceof Error ? error.message : "로그인에 실패했습니다.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <AuthHero
        title="백엔드 과제 풀이를 위한 공용 작업 공간"
        description="과제 요구사항 확인, IDE 작업, 제출 기록, 리포트 검토를 한 흐름으로 묶은 AIG 작업 공간입니다."
      />

      <section className="auth-form-panel">
        <div className="auth-form-panel__tabs">
          <span className="auth-form-panel__tab auth-form-panel__tab--active">로그인</span>
          <Link href="/signup" className="auth-form-panel__tab">
            회원가입
          </Link>
        </div>

        <div className="stack-24">
          <div>
            <span className="eyebrow">작업 시작</span>
            <h1>기존 세션 이어서 시작</h1>
            <p className="muted-copy">이전 실습 기록과 제출 흐름을 이어서 확인합니다.</p>
          </div>

          <button className="button social-button" type="button">
            GitHub 계정으로 계속
          </button>

          <div className="divider">
            <span>또는 이메일로 로그인</span>
          </div>

          <div className="stack-16">
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
          </div>

          <div className="form-row">
            <span className="text-link">비밀번호 찾기</span>
            <button className="button button--primary" onClick={handleLogin} disabled={loading}>
              {loading ? "로그인 중..." : "로그인"}
            </button>
          </div>
        </div>

        <p className="auth-form-panel__foot">
          아직 계정이 없나요? <Link href="/signup">회원가입</Link>
        </p>
      </section>
    </>
  );
}

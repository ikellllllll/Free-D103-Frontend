"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { useRouteScope } from "@/components/routing/RouteScopeProvider";
import { authApi, buildUserFromToken } from "@/lib/api/authApi";
import { useAuthStore } from "@/store/authStore";
import { useUiStore } from "@/store/uiStore";

export default function SignupPage() {
  const router = useRouter();
  const { withPrefix } = useRouteScope();
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
      const signupData = await authApi.signup(email, password, name);
      const tokens = await authApi.login(email, password);
      const user = buildUserFromToken(tokens.accessToken, {
        id: String(signupData.userId),
        name: signupData.nickname,
        email: signupData.email,
        provider: "LOCAL",
        createdAt: new Date().toISOString()
      });
      signIn(user, tokens);
      addToast("계정이 생성되었습니다.", "success");
      router.push(withPrefix("/problems"));
    } catch (error) {
      addToast(error instanceof Error ? error.message : "회원가입에 실패했습니다.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void handleSignup();
  };

  return (
    <form className="stack-24" onSubmit={handleSubmit}>
      <div className="stack-16">
        <label className="field">
          <span>이름</span>
          <input
            id="signup-name"
            name="name"
            className="input"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>

        <label className="field">
          <span>이메일</span>
          <input
            id="signup-email"
            name="email"
            className="input"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        <label className="field">
          <span>비밀번호</span>
          <input
            id="signup-password"
            name="password"
            className="input"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        <label className="field">
          <span>비밀번호 확인</span>
          <input
            id="signup-password-confirm"
            name="confirmPassword"
            className="input"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </label>
      </div>

      <button className="button button--primary" type="submit" disabled={loading}>
        {loading ? "생성 중..." : "계정 만들기"}
      </button>
    </form>
  );
}

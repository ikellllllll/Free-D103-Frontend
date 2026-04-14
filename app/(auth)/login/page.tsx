"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { useRouteScope } from "@/components/routing/RouteScopeProvider";
import { mockApi } from "@/lib/api/mockApi";
import { useAuthStore } from "@/store/authStore";
import { useUiStore } from "@/store/uiStore";

export default function LoginPage() {
  const router = useRouter();
  const { withPrefix } = useRouteScope();
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
      router.push(withPrefix("/problems"));
    } catch (error) {
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
    <form className="stack-24" onSubmit={handleSubmit}>
      <button className="button social-button" type="button">
        GitHub 계정으로 계속
      </button>

      <div className="divider">
        <span>또는 이메일로 로그인</span>
      </div>

      <div className="stack-16">
        <label className="field">
          <span>이메일</span>
          <input
            id="login-email"
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
            id="login-password"
            name="password"
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
      </div>

      <div className="form-row">
        <span className="text-link">비밀번호 찾기</span>
        <button className="button button--primary" type="submit" disabled={loading}>
          {loading ? "로그인 중..." : "로그인"}
        </button>
      </div>
    </form>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff } from "lucide-react";

import { useRouteScope } from "@/components/routing/RouteScopeProvider";
import { useGithubOAuthLogin } from "@/hooks/useGithubOAuthLogin";
import { authApi, buildUserFromToken } from "@/lib/api/authApi";
import { useAuthStore } from "@/store/authStore";
import { useUiStore } from "@/store/uiStore";

export default function LoginPage() {
  const router = useRouter();
  const { withPrefix } = useRouteScope();
  const signIn = useAuthStore((s) => s.signIn);
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);
  const addToast = useUiStore((s) => s.addToast);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { githubOAuthLoading, startGithubOAuth } = useGithubOAuthLogin();

  useEffect(() => {
    if (!hydrated || !user) return;
    router.replace(withPrefix("/problems"));
  }, [hydrated, router, user, withPrefix]);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const tokens = await authApi.login(email, password);
      const user = buildUserFromToken(tokens.accessToken, {
        email: tokens.email ?? email,
        name: tokens.nickname,
      });
      signIn(user, tokens);
      addToast("로그인되었습니다.", "success");
      router.push(withPrefix("/problems"));
    } catch (error) {
      addToast(
        error instanceof Error ? error.message : "로그인에 실패했습니다.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void handleLogin();
  };

  return (
    <div className="login-v0-lite w-full max-w-md animate-scale-in">
      <div className="login-v0-lite__card bg-white rounded-3xl p-8">
        <h1 className="text-center text-2xl md:text-3xl font-display font-bold text-gray-900 tracking-tight mb-2">
          환영합니다
        </h1>
        <p className="login-v0-lite__intro text-center text-sm text-gray-500 mb-6">
          이메일과 비밀번호로 로그인해 주세요.
        </p>

        <button
          type="button"
          onClick={startGithubOAuth}
          disabled={githubOAuthLoading || loading}
          className="login-v0-lite__social w-full flex items-center justify-center px-4 py-2.5 rounded-2xl text-sm font-medium text-gray-700 mb-5"
        >
          <Image
            src="/icons8-github-%EB%A1%9C%EA%B3%A0.svg"
            alt=""
            width={18}
            height={18}
            aria-hidden
          />
          <span>{githubOAuthLoading ? "GitHub로 이동 중..." : "GitHub 계정으로 계속"}</span>
          {!githubOAuthLoading && <ArrowRight size={15} strokeWidth={2.3} className="login-v0-lite__social-arrow" />}
        </button>

        <div className="login-v0-lite__divider flex items-center mb-5">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="px-3 text-xs text-gray-400 uppercase tracking-wider">또는</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="login-v0-lite__field block">
            <span className="login-v0-lite__field-label block text-sm font-semibold text-gray-800 mb-1.5">
              이메일
            </span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="auth-input login-v0-lite__input"
            />
          </label>

          <label className="login-v0-lite__field block">
            <div className="flex items-center justify-between mb-1.5">
              <span className="login-v0-lite__field-label block text-sm font-semibold text-gray-800">
                비밀번호
              </span>
              <button type="button" tabIndex={-1} className="login-v0-lite__text-link text-xs">
                비밀번호 찾기
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호를 입력해 주세요"
                className="auth-input login-v0-lite__input pr-10"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((v) => !v)}
                className="login-v0-lite__peek absolute right-3 inset-y-0 flex items-center"
                aria-label="비밀번호 표시"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="login-v0-lite__submit w-full flex items-center justify-center space-x-2 text-white font-semibold py-3 rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed mt-1"
            style={{
              backgroundImage: "linear-gradient(90deg, #4F46E5, #7C3AED)",
              boxShadow: "0 12px 28px -10px rgba(99, 102, 241, 0.5)"
            }}
          >
            <span>{loading ? "로그인 중..." : "로그인"}</span>
            {!loading && <ArrowRight size={16} strokeWidth={2.4} />}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-8">
          계정이 없으신가요?{" "}
          <Link
            href={withPrefix("/signup")}
            className="login-v0-lite__text-link font-semibold"
          >
            회원가입
          </Link>
          <span className="mx-2 text-gray-300">·</span>
          <Link
            href={withPrefix("/problems")}
            className="login-v0-lite__text-link font-semibold"
          >
            둘러보기
          </Link>
        </p>
      </div>
    </div>
  );
}

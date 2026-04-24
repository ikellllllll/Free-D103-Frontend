"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff } from "lucide-react";

import { useRouteScope } from "@/components/routing/RouteScopeProvider";
import { mockApi } from "@/lib/api/mockApi";
import { useAuthStore } from "@/store/authStore";
import { useUiStore } from "@/store/uiStore";

export default function Dev2LoginPage() {
  const router = useRouter();
  const { withPrefix } = useRouteScope();
  const signIn = useAuthStore((s) => s.signIn);
  const addToast = useUiStore((s) => s.addToast);
  const [email, setEmail] = useState("user@email.com");
  const [password, setPassword] = useState("password");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const user = await mockApi.login({ email, password });
      signIn(user);
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
    <div className="w-full max-w-md animate-scale-in">
      <div className="bg-white rounded-3xl shadow-2xl p-8">
        <h1 className="text-center text-2xl md:text-3xl font-display font-bold text-gray-900 tracking-tight mb-2">
          다시 오신 걸 환영합니다
        </h1>
        <p className="text-center text-sm text-gray-500 mb-6">
          이메일과 비밀번호로 로그인하세요.
        </p>

        <button
          type="button"
          className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-2xl border border-gray-300 bg-gray-200 hover:border-gray-400 hover:bg-gray-300 transition-colors text-sm font-medium text-gray-700 mb-5"
        >
          <Image
            src="/icons8-github-%EB%A1%9C%EA%B3%A0.svg"
            alt=""
            width={18}
            height={18}
            aria-hidden
          />
          <span>GitHub 계정으로 계속</span>
        </button>

        <div className="flex items-center mb-5">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="px-3 text-xs text-gray-400 uppercase tracking-wider">또는</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block">
            <span className="block text-sm font-semibold text-gray-800 mb-1.5">이메일</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="auth-input"
            />
          </label>

          <label className="block">
            <div className="flex items-center justify-between mb-1.5">
              <span className="block text-sm font-semibold text-gray-800">비밀번호</span>
              <button type="button" className="text-xs text-indigo-600 hover:text-indigo-700">
                비밀번호 찾기
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호를 입력하세요"
                className="auth-input pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 inset-y-0 flex items-center text-gray-400 hover:text-gray-600"
                aria-label="비밀번호 표시"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center space-x-2 text-white font-semibold py-3 rounded-2xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed mt-1"
            style={{
              backgroundImage: "linear-gradient(90deg, #4F46E5, #7C3AED)",
              boxShadow: "0 12px 28px -10px rgba(99, 102, 241, 0.5)"
            }}
          >
            <span>{loading ? "로그인 중…" : "로그인"}</span>
            {!loading && <ArrowRight size={16} strokeWidth={2.4} />}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-8">
          계정이 없으신가요?{" "}
          <Link
            href="/signup"
            className="text-indigo-600 font-semibold hover:text-indigo-700"
          >
            회원가입
          </Link>
        </p>
      </div>
    </div>
  );
}

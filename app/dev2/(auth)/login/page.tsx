"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Sparkles, ArrowRight } from "lucide-react";

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
      <div className="bg-white/90 backdrop-blur-sm rounded-3xl border border-gray-100 shadow-xl p-8 md:p-10">
        <div className="mb-8">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold mb-4">
            <Sparkles size={12} strokeWidth={2.4} />
            <span>AIG 로그인</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-gray-900 tracking-tight mb-2">
            다시 오신 걸 환영합니다
          </h1>
          <p className="text-sm text-gray-500">
            이메일과 비밀번호로 로그인하세요.
          </p>
        </div>

        <button
          type="button"
          className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
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

        <div className="flex items-center my-6">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="px-3 text-xs text-gray-400 uppercase tracking-wider">또는</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="block text-xs font-semibold text-gray-700 mb-1.5">이메일</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
            />
          </label>
          <label className="block">
            <div className="flex items-center justify-between mb-1.5">
              <span className="block text-xs font-semibold text-gray-700">비밀번호</span>
              <button type="button" className="text-xs text-indigo-600 hover:text-indigo-700">
                비밀번호 찾기
              </button>
            </div>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
          >
            <span>{loading ? "로그인 중…" : "로그인"}</span>
            {!loading && <ArrowRight size={16} strokeWidth={2.4} />}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-8">
          계정이 없으신가요?{" "}
          <Link href="/dev2/signup" className="text-indigo-600 font-semibold hover:text-indigo-700">
            회원가입
          </Link>
        </p>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Sparkles, ArrowRight } from "lucide-react";

import { useRouteScope } from "@/components/routing/RouteScopeProvider";
import { mockApi } from "@/lib/api/mockApi";
import { useAuthStore } from "@/store/authStore";
import { useUiStore } from "@/store/uiStore";

export default function Dev2SignupPage() {
  const router = useRouter();
  const { withPrefix } = useRouteScope();
  const signIn = useAuthStore((s) => s.signIn);
  const addToast = useUiStore((s) => s.addToast);
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
      router.push(withPrefix("/problems"));
    } catch (error) {
      addToast(
        error instanceof Error ? error.message : "회원가입에 실패했습니다.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void handleSignup();
  };

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xl p-8 md:p-10">
        <div className="mb-8">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold mb-4">
            <Sparkles size={12} strokeWidth={2.4} />
            <span>AIG 회원가입</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-gray-900 tracking-tight mb-2">
            AI 코딩 워크스페이스 시작하기
          </h1>
          <p className="text-sm text-gray-500">
            몇 초만에 계정을 만들고 바로 과제를 시작할 수 있습니다.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="block text-xs font-semibold text-gray-700 mb-1.5">이름</span>
            <input
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
            />
          </label>
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
            <span className="block text-xs font-semibold text-gray-700 mb-1.5">비밀번호</span>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-semibold text-gray-700 mb-1.5">비밀번호 확인</span>
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
          >
            <span>{loading ? "생성 중…" : "계정 만들기"}</span>
            {!loading && <ArrowRight size={16} strokeWidth={2.4} />}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-8">
          이미 계정이 있나요?{" "}
          <Link href="/dev2/login" className="text-indigo-600 font-semibold hover:text-indigo-700">
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
}

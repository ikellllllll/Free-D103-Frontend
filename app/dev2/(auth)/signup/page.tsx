"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Sparkles, ArrowRight, Eye, EyeOff } from "lucide-react";

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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
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
    <div className="w-full max-w-md animate-scale-in">
      <div className="bg-white rounded-3xl shadow-2xl p-10">
        {/* Pill badge */}
        <div className="flex justify-center mb-6">
          <div
            className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full border border-indigo-100 text-indigo-600 text-xs font-semibold"
            style={{ background: "#EEF2FF" }}
          >
            <Sparkles size={12} strokeWidth={2.4} />
            <span>AIG 회원가입</span>
          </div>
        </div>

        <h1 className="text-center text-2xl md:text-3xl font-display font-bold text-gray-900 tracking-tight mb-2">
          AI 워크스페이스 시작하기
        </h1>
        <p className="text-center text-sm text-gray-500 mb-8">
          몇 초만에 계정을 만들고 바로 첫 과제를 시작하세요.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="이름">
            <input
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="이름을 입력하세요"
              className="auth-input"
            />
          </Field>

          <Field label="이메일">
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="auth-input"
            />
          </Field>

          <Field label="비밀번호">
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="안전한 비밀번호를 설정하세요"
                className="auth-input pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label="비밀번호 표시"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </Field>

          <Field label="비밀번호 확인">
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="다시 한 번 입력하세요"
                className="auth-input pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label="비밀번호 확인 표시"
              >
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </Field>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center space-x-2 text-white font-semibold py-3.5 rounded-2xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            style={{
              backgroundImage: "linear-gradient(90deg, #4F46E5, #7C3AED)",
              boxShadow: "0 12px 28px -10px rgba(99, 102, 241, 0.5)"
            }}
          >
            <span>{loading ? "생성 중…" : "계정 만들기"}</span>
            {!loading && <ArrowRight size={16} strokeWidth={2.4} />}
          </button>

          <p className="text-center text-xs text-gray-500 pt-2">
            계속하면 <a href="#" className="text-indigo-600 font-semibold hover:text-indigo-700">이용약관</a>에 동의하는 것으로 간주됩니다.
          </p>
        </form>

        <p className="text-center text-sm text-gray-500 mt-8">
          이미 계정이 있나요?{" "}
          <Link
            href="/dev2/login"
            className="text-indigo-600 font-semibold hover:text-indigo-700"
          >
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold text-gray-800 mb-2">{label}</span>
      {children}
    </label>
  );
}

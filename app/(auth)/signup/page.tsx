"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { ArrowRight, Eye, EyeOff } from "lucide-react";

import { useRouteScope } from "@/components/routing/RouteScopeProvider";
import { authApi, buildUserFromToken } from "@/lib/api/authApi";
import { useAuthStore } from "@/store/authStore";
import { useUiStore } from "@/store/uiStore";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getPasswordStrength(pw: string): { level: 0 | 1 | 2 | 3; label: string; color: string } {
  if (pw.length === 0) return { level: 0, label: "", color: "" };
  if (pw.length < 8) return { level: 1, label: "약함", color: "bg-red-400" };
  const checks = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((r) => r.test(pw)).length;
  if (checks >= 3) return { level: 3, label: "강함", color: "bg-green-500" };
  return { level: 2, label: "보통", color: "bg-yellow-400" };
}

export default function SignupPage() {
  const router = useRouter();
  const { withPrefix } = useRouteScope();
  const signIn = useAuthStore((s) => s.signIn);
  const addToast = useUiStore((s) => s.addToast);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [emailChecked, setEmailChecked] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const strength = getPasswordStrength(password);

  const handleEmailBlur = async () => {
    if (!EMAIL_REGEX.test(email)) return;
    try {
      const available = await authApi.checkEmailAvailability(email);
      if (!available) {
        setEmailError("이미 사용 중인 이메일입니다.");
        setEmailChecked(false);
      } else {
        setEmailError("");
        setEmailChecked(true);
      }
    } catch {
      // 서버 에러는 제출 시점에 다시 처리
    }
  };

  const handleSignup = async () => {
    setEmailError("");
    setPasswordError("");

    if (!name.trim()) {
      addToast("이름을 입력해 주세요.", "warning");
      return;
    }
    if (!EMAIL_REGEX.test(email)) {
      setEmailError("올바른 이메일 형식이 아닙니다.");
      return;
    }
    if (!emailChecked) {
      setEmailError("이메일 중복 확인이 필요합니다.");
      return;
    }
    if (password.length < 8) {
      setPasswordError("비밀번호는 8자 이상이어야 합니다.");
      return;
    }
    if (password !== confirmPassword) {
      setPasswordError("비밀번호가 일치하지 않습니다.");
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
    <div className="login-v0-lite w-full max-w-md animate-scale-in">
      <div className="login-v0-lite__card bg-white rounded-3xl p-8">
        <h1 className="text-center text-2xl md:text-3xl font-display font-bold text-gray-900 tracking-tight mb-2">
          AI 워크스페이스 시작하기
        </h1>
        <p className="login-v0-lite__intro text-center text-sm text-gray-500 mb-5">
          몇 초만에 계정을 만들고 바로 첫 과제를 시작해 보세요.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <Field label="이름">
            <input
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="이름을 입력해 주세요"
              className="auth-input login-v0-lite__input"
            />
          </Field>

          <div>
            <Field label="이메일">
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailError("");
                  setEmailChecked(false);
                }}
                onBlur={() => {
                  void handleEmailBlur();
                }}
                placeholder="you@example.com"
                className={`auth-input login-v0-lite__input${emailError ? " !border-red-400" : ""}`}
              />
            </Field>
            {emailError && <p className="text-xs text-red-500 mt-1 ml-0.5">{emailError}</p>}
          </div>

          <div>
            <Field label="비밀번호">
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setPasswordError("");
                  }}
                  placeholder="8자 이상 입력해 주세요"
                  className={`auth-input login-v0-lite__input pr-10${passwordError ? " !border-red-400" : ""}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="login-v0-lite__peek absolute right-3 inset-y-0 flex items-center"
                  aria-label="비밀번호 표시"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>
            {strength.level > 0 && (
              <div className="mt-1.5 space-y-1">
                <div className="flex gap-1">
                  {[1, 2, 3].map((n) => (
                    <div
                      key={n}
                      className={`h-1 flex-1 rounded-full transition-colors ${strength.level >= n ? strength.color : "bg-gray-200"}`}
                    />
                  ))}
                </div>
                <p
                  className={`text-xs ml-0.5 ${
                    strength.level === 1
                      ? "text-red-500"
                      : strength.level === 2
                        ? "text-yellow-600"
                        : "text-green-600"
                  }`}
                >
                  비밀번호 강도: {strength.label}
                </p>
              </div>
            )}
            {passwordError && <p className="text-xs text-red-500 mt-1 ml-0.5">{passwordError}</p>}
          </div>

          <Field label="비밀번호 확인">
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="다시 한 번 입력해 주세요"
                className="auth-input login-v0-lite__input pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="login-v0-lite__peek absolute right-3 inset-y-0 flex items-center"
                aria-label="비밀번호 확인 표시"
              >
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </Field>

          <button
            type="submit"
            disabled={loading}
            className="login-v0-lite__submit w-full flex items-center justify-center space-x-2 text-white font-semibold py-3 rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed mt-1"
            style={{
              backgroundImage: "linear-gradient(90deg, #4F46E5, #7C3AED)",
              boxShadow: "0 12px 28px -10px rgba(99, 102, 241, 0.5)"
            }}
          >
            <span>{loading ? "생성 중..." : "계정 만들기"}</span>
            {!loading && <ArrowRight size={16} strokeWidth={2.4} />}
          </button>

          <p className="text-center text-xs text-gray-500 pt-1">
            계속하면{" "}
            <Link
              href={withPrefix("/terms")}
              className="login-v0-lite__text-link font-semibold"
            >
              이용약관
            </Link>
            에 동의하는 것으로 간주됩니다.
          </p>
        </form>

        <p className="text-center text-sm text-gray-500 mt-8">
          이미 계정이 있나요?{" "}
          <Link
            href={withPrefix("/login")}
            className="login-v0-lite__text-link font-semibold"
          >
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="login-v0-lite__field block">
      <span className="login-v0-lite__field-label block text-sm font-semibold text-gray-800 mb-1.5">
        {label}
      </span>
      {children}
    </label>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { BrandLogo } from "@/components/brand/BrandLogo";

import { useRouteScope } from "@/components/routing/RouteScopeProvider";
import { ThemeToggle } from "@/components/system/ThemeToggle";
import { authApi } from "@/lib/api/authApi";
import { useAuthStore } from "@/store/authStore";
import { useUiStore } from "@/store/uiStore";

const navItems = [
  { href: "/problems", label: "과제" },
  { href: "/mypage", label: "마이페이지" }
];

export function AppHeader() {
  const router = useRouter();
  const { currentPath, withPrefix } = useRouteScope();
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const addToast = useUiStore((state) => state.addToast);

  const handleLogout = async () => {
    const { tokens } = useAuthStore.getState();
    if (tokens?.refreshToken) {
      try { await authApi.logout(tokens.refreshToken); } catch { /* 서버 오류여도 로컬 로그아웃 진행 */ }
    }
    signOut();
    addToast("로그아웃되었습니다.", "success");
    router.replace(withPrefix("/login"));
  };

  return (
    <header className="app-header">
      <div className="app-header__inner">
        <Link href={withPrefix("/problems")} className="brand">
          <BrandLogo variant="primary-word" height={26} />
          <span className="brand__meta">
            <strong>AI Interview Guide</strong>
            <span>과제 풀이, AI 활용 흐름, 피드백 리포트를 한 곳에서 다룹니다.</span>
          </span>
        </Link>

        <nav className="top-nav">
          {navItems.map((item) => {
            const active = currentPath === item.href || currentPath.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={withPrefix(item.href)}
                className={active ? "top-nav__link top-nav__link--active" : "top-nav__link"}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="app-header__actions">
          <ThemeToggle inline />

          <div className="profile-pill">
            <span className="profile-pill__avatar">{user?.name?.slice(0, 1) ?? "U"}</span>
            <div>
              <strong style={{ fontSize: "0.88rem" }}>{user?.name ?? "사용자"}</strong>
              <span style={{ fontSize: "0.76rem" }}>{user?.email ?? "세션 없음"}</span>
            </div>
            <button
              className="button button--ghost"
              onClick={handleLogout}
              style={{ fontSize: "0.82rem", padding: "4px 10px" }}
            >
              로그아웃
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, History, User, Sun, Moon, LogOut } from "lucide-react";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { useRouteScope } from "@/components/routing/RouteScopeProvider";
import { mockApi } from "@/lib/api/mockApi";
import { useAuthStore } from "@/store/authStore";
import { useThemeStore } from "@/store/themeStore";
import { useUiStore } from "@/store/uiStore";

const navItems = [
  { href: "/problems", icon: BookOpen, label: "과제 목록" },
  { href: "/sessions", icon: History, label: "풀이 기록" },
  { href: "/mypage", icon: User, label: "마이페이지" }
];

export function AppSidebar() {
  const router = useRouter();
  const { currentPath, withPrefix } = useRouteScope();
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const theme = useThemeStore((state) => state.theme);
  const hydrated = useThemeStore((state) => state.hydrated);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const addToast = useUiStore((state) => state.addToast);

  const handleLogout = async () => {
    await mockApi.logout();
    signOut();
    addToast("로그아웃되었습니다.", "success");
    router.replace(withPrefix("/login"));
  };

  return (
    <aside className="app-sidebar">
      {/* Brand */}
      <Link href={withPrefix("/problems")} className="app-sidebar__brand" aria-label="AIG 홈">
        <BrandLogo variant="app-icon" height={22} />
        <BrandLogo variant="primary-word" height={16} className="app-sidebar__brand-label" />
      </Link>

      {/* Nav */}
      <nav className="app-sidebar__nav" aria-label="주 탐색">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = currentPath === href || currentPath.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={withPrefix(href)}
              className={`sidebar-item${active ? " sidebar-item--active" : ""}`}
              aria-label={label}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
              <span className="sidebar-item__label">{label}</span>
              <span className="sidebar-item__tooltip">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="app-sidebar__foot">
        {hydrated && (
          <button
            type="button"
            className="sidebar-item"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"}
          >
            {theme === "dark" ? <Sun size={16} strokeWidth={1.8} /> : <Moon size={16} strokeWidth={1.8} />}
            <span className="sidebar-item__label">{theme === "dark" ? "라이트 모드" : "다크 모드"}</span>
            <span className="sidebar-item__tooltip">{theme === "dark" ? "라이트 모드" : "다크 모드"}</span>
          </button>
        )}

        <button
          type="button"
          className="sidebar-item"
          onClick={handleLogout}
          aria-label="로그아웃"
        >
          <LogOut size={16} strokeWidth={1.8} />
          <span className="sidebar-item__label">로그아웃</span>
          <span className="sidebar-item__tooltip">로그아웃</span>
        </button>

        {/* User block */}
        <div className="sidebar-user">
          <span className="sidebar-avatar" title={user?.name ?? "사용자"}>
            {user?.name?.slice(0, 1)?.toUpperCase() ?? "U"}
          </span>
          <span className="sidebar-user__name">{user?.name ?? "사용자"}</span>
        </div>
      </div>
    </aside>
  );
}

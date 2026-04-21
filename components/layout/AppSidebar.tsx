"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, History, User, Sun, Moon, LogOut } from "lucide-react";

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

function SidebarThemeLogo() {
  return (
    <span className="sidebar-theme-logo" aria-label="AIGround" role="img">
      <svg className="sidebar-theme-logo__icon" viewBox="0 0 64 64" aria-hidden="true">
        <rect x="8" y="8" width="48" height="48" rx="14" fill="var(--accent)" />
        <path
          d="M20 44L31 18h5l11 26h-6l-2.3-5.8H28.1L25.9 44H20Zm10-10.8h6.8L33.4 24l-3.4 9.2Z"
          fill="var(--bg)"
        />
      </svg>
      <svg className="sidebar-theme-logo__word" viewBox="110 68 960 190" aria-hidden="true">
        <text
          x="130"
          y="218"
          fill="var(--accent)"
          fontSize="188"
          fontWeight="800"
          fontFamily="'Segoe UI', Arial, sans-serif"
          letterSpacing="-6"
        >
          AIG
        </text>
        <text
          x="470"
          y="218"
          fill="var(--accent-strong)"
          fontSize="128"
          fontWeight="600"
          fontFamily="'Segoe UI', Arial, sans-serif"
          letterSpacing="-3"
        >
          round
        </text>
      </svg>
    </span>
  );
}

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
      <Link href={withPrefix("/problems")} className="app-sidebar__brand" aria-label="AIG 홈">
        <SidebarThemeLogo />
      </Link>

      <nav className="app-sidebar__nav" aria-label="주요 탐색">
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

        <button type="button" className="sidebar-item" onClick={handleLogout} aria-label="로그아웃">
          <LogOut size={16} strokeWidth={1.8} />
          <span className="sidebar-item__label">로그아웃</span>
          <span className="sidebar-item__tooltip">로그아웃</span>
        </button>

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

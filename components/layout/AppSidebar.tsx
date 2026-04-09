"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BookOpen, Wrench, User, Sun, Moon, LogOut, Zap } from "lucide-react";

import { ThemeToggle } from "@/components/system/ThemeToggle";
import { mockApi } from "@/lib/api/mockApi";
import { useAuthStore } from "@/store/authStore";
import { useThemeStore } from "@/store/themeStore";
import { useUiStore } from "@/store/uiStore";

const navItems = [
  { href: "/problems", icon: BookOpen, label: "과제" },
  { href: "/workshop", icon: Wrench, label: "워크숍" },
  { href: "/mypage", icon: User, label: "마이페이지" }
];

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
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
    router.replace("/login");
  };

  return (
    <aside className="app-sidebar">
      {/* Brand */}
      <Link href="/problems" className="app-sidebar__brand" aria-label="AIG 홈">
        <Zap size={16} />
      </Link>

      {/* Nav */}
      <nav className="app-sidebar__nav" aria-label="주 탐색">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname?.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={`sidebar-item${active ? " sidebar-item--active" : ""}`}
              aria-label={label}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
              <span className="sidebar-item__tooltip">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="app-sidebar__foot">
        {/* Theme toggle */}
        {hydrated && (
          <button
            type="button"
            className="sidebar-item"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"}
          >
            {theme === "dark" ? <Sun size={16} strokeWidth={1.8} /> : <Moon size={16} strokeWidth={1.8} />}
            <span className="sidebar-item__tooltip">{theme === "dark" ? "라이트 모드" : "다크 모드"}</span>
          </button>
        )}

        {/* Logout */}
        <button
          type="button"
          className="sidebar-item"
          onClick={handleLogout}
          aria-label="로그아웃"
        >
          <LogOut size={16} strokeWidth={1.8} />
          <span className="sidebar-item__tooltip">로그아웃 ({user?.name ?? ""})</span>
        </button>

        {/* Avatar */}
        <span className="sidebar-avatar" title={user?.name ?? "사용자"}>
          {user?.name?.slice(0, 1)?.toUpperCase() ?? "U"}
        </span>
      </div>
    </aside>
  );
}

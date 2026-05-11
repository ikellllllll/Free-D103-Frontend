"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Sun, Moon, LogOut, User } from "lucide-react";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { useRouteScope } from "@/components/routing/RouteScopeProvider";
import { authApi } from "@/lib/api/authApi";
import { useAuthStore } from "@/store/authStore";
import { useThemeStore } from "@/store/themeStore";
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
  const theme = useThemeStore((state) => state.theme);
  const hydrated = useThemeStore((state) => state.hydrated);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);

  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleLogout = async () => {
    setOpen(false);
    const { tokens } = useAuthStore.getState();
    if (tokens?.refreshToken) {
      try { await authApi.logout(tokens.refreshToken); } catch { /* 서버 오류여도 로컬 로그아웃 진행 */ }
    }
    signOut();
    addToast("로그아웃되었습니다.", "success");
    router.replace(withPrefix("/login"));
  };

  const initials = (user?.name ?? "U").slice(0, 1).toUpperCase();
  const name = user?.name ?? "사용자";
  const email = user?.email ?? "세션 없음";

  return (
    <header className="app-header">
      <div className="app-header__inner">
        <Link href={withPrefix("/problems")} className="brand">
          <BrandLogo variant="app-icon" height={35} />
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
          {/* Avatar button + dropdown */}
          <div ref={dropdownRef} style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-label="계정 메뉴"
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "#fff",
                color: "#6b7280",
                fontWeight: 700,
                fontSize: "0.9rem",
                border: open ? "1px solid rgba(99,102,241,0.35)" : "1px solid rgba(229,231,235,1)",
                boxShadow: open ? "0 0 0 3px rgba(99,102,241,0.14)" : "0 1px 2px rgba(17,24,39,0.06)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "box-shadow 0.2s, border-color 0.2s",
                flexShrink: 0
              }}
            >
              <User size={18} strokeWidth={2} />
            </button>

            {open && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  right: 0,
                  minWidth: 220,
                  background: "var(--surface-1, #fff)",
                  border: "1px solid var(--line, rgba(0,0,0,0.08))",
                  borderRadius: 14,
                  boxShadow: "0 8px 32px -8px rgba(17,24,39,0.18), 0 2px 8px rgba(17,24,39,0.06)",
                  zIndex: 200,
                  overflow: "hidden"
                }}
              >
                {/* User info — clickable to navigate to mypage */}
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    router.push(withPrefix("/mypage"));
                  }}
                  style={{
                    width: "100%",
                    padding: "14px 16px 12px",
                    borderBottom: "1px solid var(--line, rgba(0,0,0,0.08))",
                    background: "none",
                    border: "none",
                    borderBottomLeftRadius: 0,
                    borderBottomRightRadius: 0,
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "background 0.15s"
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--hover, rgba(0,0,0,0.04))")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                  aria-label="마이페이지로 이동"
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: "50%",
                      background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                      color: "#fff",
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
                    }}>
                      <User size={15} strokeWidth={2} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--text-1, #111827)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {name}
                      </div>
                      <div style={{ fontSize: "0.74rem", color: "var(--text-3, #9ca3af)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {email}
                      </div>
                    </div>
                  </div>
                </button>

                {/* Theme toggle */}
                {hydrated && (
                  <button
                    type="button"
                    onClick={toggleTheme}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 16px", background: "none", border: "none",
                      cursor: "pointer", fontSize: "0.86rem", color: "var(--text-2, #374151)",
                      fontWeight: 500, transition: "background 0.15s"
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--hover, rgba(0,0,0,0.04))")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                  >
                    {theme === "dark"
                      ? <Sun size={15} strokeWidth={1.8} />
                      : <Moon size={15} strokeWidth={1.8} />}
                    <span>{theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"}</span>
                  </button>
                )}

                {/* Divider */}
                <div style={{ height: 1, background: "var(--line, rgba(0,0,0,0.08))", margin: "2px 0" }} />

                {/* Logout */}
                <button
                  type="button"
                  onClick={handleLogout}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 16px", background: "none", border: "none",
                    cursor: "pointer", fontSize: "0.86rem", color: "#ef4444",
                    fontWeight: 500, transition: "background 0.15s"
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(239,68,68,0.06)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                >
                  <LogOut size={15} strokeWidth={1.8} />
                  <span>로그아웃</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

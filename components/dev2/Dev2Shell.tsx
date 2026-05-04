"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  BookOpen,
  History,
  TestTube,
  User,
  Sun,
  Moon,
  LogOut,
  Search,
  Menu,
  X,
  type LucideIcon
} from "lucide-react";

import { useRouteScope } from "@/components/routing/RouteScopeProvider";
import { authApi } from "@/lib/api/authApi";
import { useAuthStore } from "@/store/authStore";
import { useThemeStore } from "@/store/themeStore";
import { useUiStore } from "@/store/uiStore";

type NavItem = { href: string; icon: LucideIcon; label: string };

const NAV_ITEMS: NavItem[] = [
  { href: "/problems", icon: BookOpen, label: "과제 목록" },
  { href: "/sessions", icon: History, label: "풀이 기록" },
  { href: "/harness", icon: TestTube, label: "하네스" },
  { href: "/mypage", icon: User, label: "마이페이지" }
];

type PaletteItem = {
  id: string;
  label: string;
  href?: string;
  action?: () => void;
  icon: LucideIcon;
};

export function Dev2Shell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { currentPath, withPrefix } = useRouteScope();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const theme = useThemeStore((s) => s.theme);
  const hydrated = useThemeStore((s) => s.hydrated);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const addToast = useUiStore((s) => s.addToast);

  const [paletteOpen, setPaletteOpen] = useState(false);
  const isMac = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    return /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent || "");
  }, []);
  const shortcutLabel = isMac ? "⌘K" : "Ctrl K";
  const [paletteQuery, setPaletteQuery] = useState("");
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleLogout = async () => {
    const { tokens } = useAuthStore.getState();
    if (tokens?.refreshToken) {
      try { await authApi.logout(tokens.refreshToken); } catch { /* 서버 오류여도 로컬 로그아웃 진행 */ }
    }
    signOut();
    addToast("로그아웃되었습니다.", "success");
    router.replace(withPrefix("/login"));
  };

  const openPalette = () => {
    setPaletteOpen(true);
    setPaletteQuery("");
    setPaletteIndex(0);
  };

  const closePalette = () => {
    setPaletteOpen(false);
    setPaletteQuery("");
    setPaletteIndex(0);
  };

  // Ctrl+K / Esc
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setPaletteOpen((v) => {
          if (v) {
            setPaletteQuery("");
            setPaletteIndex(0);
            return false;
          }
          setPaletteQuery("");
          setPaletteIndex(0);
          return true;
        });
      } else if (e.key === "Escape") {
        setPaletteOpen(false);
        setUserMenuOpen(false);
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const allItems: PaletteItem[] = useMemo(() => {
    const items: PaletteItem[] = NAV_ITEMS.map((n) => ({
      id: `nav-${n.href}`,
      label: n.label,
      href: n.href,
      icon: n.icon
    }));
    if (hydrated) {
      items.push({
        id: "action-theme",
        label: theme === "dark" ? "라이트 모드" : "다크 모드",
        icon: theme === "dark" ? Sun : Moon,
        action: () => {
          toggleTheme();
          closePalette();
        }
      });
    }
    items.push({
      id: "action-logout",
      label: "로그아웃",
      icon: LogOut,
      action: () => {
        closePalette();
        void handleLogout();
      }
    });
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, theme]);

  const filteredItems = useMemo(() => {
    const q = paletteQuery.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter((i) => i.label.toLowerCase().includes(q));
  }, [allItems, paletteQuery]);

  useEffect(() => {
    if (!paletteOpen) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setPaletteIndex((i) => Math.min(filteredItems.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setPaletteIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = filteredItems[paletteIndex];
        if (!item) return;
        if (item.href) {
          closePalette();
          router.push(withPrefix(item.href));
        } else if (item.action) {
          item.action();
        }
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [paletteOpen, filteredItems, paletteIndex, router, withPrefix]);

  return (
    <div className="dev2-app-shell min-h-screen bg-white font-sans">
      {/* ── Topbar ── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-b border-gray-200 shadow-sm pointer-events-auto">
        <div className="h-14 max-w-6xl mx-auto flex items-center justify-between px-6">
          <Link
            href={withPrefix("/problems")}
            className="group flex items-center space-x-2 font-display font-bold text-lg shrink-0"
          >
            <Image src="/brand/favicon.png" alt="AIG" width={28} height={28} className="rounded-lg object-cover" />
            <span className="text-indigo-600">AIG</span>
          </Link>

          <nav className="hidden md:flex items-center space-x-1 text-sm font-medium text-gray-600 mx-6">
            {NAV_ITEMS.map((item) => {
              const active =
                currentPath === item.href || currentPath.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={withPrefix(item.href)}
                  className={`px-4 py-1.5 rounded-md transition-colors ${
                    active
                      ? "bg-indigo-600 text-white"
                      : "hover:text-indigo-600 hover:bg-gray-50"
                  }`}
                >
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="hidden md:flex items-center space-x-2 shrink-0">
            <button
              type="button"
              onClick={openPalette}
              title={`명령 팔레트 (${shortcutLabel})`}
              className="group flex items-center gap-2.5 w-56 lg:w-64 h-9 pl-3 pr-2 rounded-xl bg-gray-100 ring-1 ring-inset ring-gray-300/80 text-sm text-gray-500 shadow-[inset_0_1px_2px_rgba(17,24,39,0.04)] hover:bg-gray-300/80 hover:ring-gray-400 hover:text-gray-800 transition-colors cursor-text"
            >
              <Search size={14} strokeWidth={2} className="shrink-0" />
              <span className="flex-1 text-left">검색…</span>
              <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[10px] font-semibold text-gray-500 bg-white ring-1 ring-inset ring-gray-200 rounded-md px-1.5 py-0.5 tabular-nums shadow-[0_1px_0_0_rgba(17,24,39,0.04)]">
                {shortcutLabel}
              </kbd>
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setUserMenuOpen((v) => !v)}
                className={`w-9 h-9 rounded-full bg-white text-gray-600 border border-gray-200 flex items-center justify-center transition-all shadow-sm ${
                  userMenuOpen ? "ring-2 ring-indigo-200 ring-offset-1" : "hover:border-indigo-200 hover:bg-indigo-50"
                }`}
                aria-haspopup="menu"
                aria-expanded={userMenuOpen}
              >
                <User size={18} strokeWidth={2} />
              </button>

              {userMenuOpen && (
                <div
                  className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-[0_8px_32px_-8px_rgba(17,24,39,0.18),0_2px_8px_rgba(17,24,39,0.06)] border border-gray-100 overflow-hidden z-50"
                  role="menu"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* User info */}
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
                    <div className="w-8 h-8 rounded-full bg-white text-gray-600 border border-gray-200 flex items-center justify-center shrink-0 shadow-sm">
                      <User size={16} strokeWidth={2} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate">{user?.name ?? "사용자"}</div>
                      <div className="text-xs text-gray-400 truncate">{user?.email ?? ""}</div>
                    </div>
                  </div>

                  <div className="py-1">
                    {hydrated && (
                      <button
                        type="button"
                        onClick={() => { toggleTheme(); setUserMenuOpen(false); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        {theme === "dark" ? <Sun size={15} strokeWidth={1.8} /> : <Moon size={15} strokeWidth={1.8} />}
                        <span>{theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"}</span>
                      </button>
                    )}
                    <div className="my-1 h-px bg-gray-100" />
                    <button
                      type="button"
                      onClick={() => { setUserMenuOpen(false); void handleLogout(); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <LogOut size={15} strokeWidth={1.8} />
                      <span>로그아웃</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Mobile menu button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="md:hidden text-gray-600"
            aria-label="메뉴"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white">
            <nav className="px-4 py-3 space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active =
                  currentPath === item.href || currentPath.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={withPrefix(item.href)}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium ${
                      active
                        ? "bg-indigo-50 text-indigo-700"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <Icon size={16} strokeWidth={2} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  openPalette();
                }}
                className="w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                <Search size={16} strokeWidth={2} />
                <span>찾기 (Ctrl+K)</span>
              </button>
              {hydrated && (
                <button
                  type="button"
                  onClick={() => {
                    toggleTheme();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                >
                  {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
                  <span>{theme === "dark" ? "라이트 모드" : "다크 모드"}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  void handleLogout();
                }}
                className="w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                <LogOut size={16} strokeWidth={2} />
                <span>로그아웃</span>
              </button>
            </nav>
          </div>
        )}
      </header>

      {/* ── Content (nav floats over top; pages manage their own top padding) ── */}
      <main className="min-h-screen">{children}</main>

      {/* ── Command Palette ── */}
      {paletteOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[4px] flex items-start justify-center px-4"
          style={{ paddingTop: "14vh" }}
          onClick={closePalette}
          role="presentation"
        >
          <div
            className="w-full max-w-[580px] bg-white rounded-[14px] overflow-hidden"
            style={{ boxShadow: "0 24px 80px rgba(0,0,0,0.28), 0 2px 8px rgba(0,0,0,0.08), 0 0 0 1px rgba(17,24,39,0.08)" }}
            role="dialog"
            aria-label="명령 팔레트"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Head */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
              <Search size={16} strokeWidth={2.5} className="text-gray-600 shrink-0" />
              <input
                autoFocus
                className="flex-1 text-[0.92rem] text-gray-900 placeholder-gray-400 bg-transparent border-0 outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 appearance-none caret-indigo-600"
                placeholder="검색…"
                value={paletteQuery}
                onChange={(e) => {
                  setPaletteQuery(e.target.value);
                  setPaletteIndex(0);
                }}
              />
              <kbd className="text-[10px] font-mono font-bold text-gray-600 bg-gray-100 border border-gray-300 rounded px-1.5 py-0.5">
                esc
              </kbd>
            </div>
            {/* List */}
            <div className="max-h-[60vh] overflow-y-auto p-1.5">
              {filteredItems.length === 0 ? (
                <div className="px-4 py-6 text-center text-[0.82rem] font-mono text-gray-400">결과 없음</div>
              ) : (
                filteredItems.map((item, i) => {
                  const Icon = item.icon;
                  const isNav = !!item.href;
                  return (
                    <button
                      type="button"
                      key={item.id}
                      onMouseEnter={() => setPaletteIndex(i)}
                      onClick={() => {
                        if (item.href) {
                          closePalette();
                          router.push(withPrefix(item.href));
                        } else if (item.action) {
                          item.action();
                        }
                      }}
                      className={`w-full grid items-center gap-3 px-3 py-2.5 rounded-[7px] text-left transition-colors duration-100 ${
                        i === paletteIndex
                          ? "bg-indigo-50 text-indigo-700"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                      style={{ gridTemplateColumns: "auto 1fr auto" }}
                    >
                      <Icon size={16} strokeWidth={2.5} className={i === paletteIndex ? "text-indigo-500" : "text-gray-600"} />
                      <span className="text-[0.92rem] font-semibold">{item.label}</span>
                      <span className={`text-[0.66rem] font-mono font-bold uppercase tracking-[0.08em] px-1.5 py-0.5 rounded border ${
                        i === paletteIndex
                          ? "text-indigo-500 border-indigo-300 bg-indigo-50"
                          : "text-gray-500 border-gray-300 bg-white"
                      }`}>
                        {isNav ? "page" : "action"}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

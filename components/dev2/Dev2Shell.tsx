"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  BookOpen,
  History,
  FlaskConical,
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
import { mockApi } from "@/lib/api/mockApi";
import { useAuthStore } from "@/store/authStore";
import { useThemeStore } from "@/store/themeStore";
import { useUiStore } from "@/store/uiStore";

type NavItem = { href: string; icon: LucideIcon; label: string };

const NAV_ITEMS: NavItem[] = [
  { href: "/problems", icon: BookOpen, label: "과제 목록" },
  { href: "/sessions", icon: History, label: "풀이 기록" },
  { href: "/workshop", icon: FlaskConical, label: "워크숍" },
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
    await mockApi.logout();
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
    <div className="min-h-screen bg-white font-sans">
      {/* ── Pill-shape floating nav (pure overlay, no layout space) ── */}
      <header className="fixed top-4 left-0 right-0 z-50 px-6 pointer-events-none">
        <div className="max-w-6xl mx-auto flex items-center justify-between bg-white/95 backdrop-blur-xl rounded-full px-3 pl-6 py-2.5 shadow-xl shadow-indigo-900/10 border border-white pointer-events-auto">
          <Link
            href={withPrefix("/problems")}
            className="group flex items-center space-x-2 font-display font-bold text-lg shrink-0"
          >
            <Image src="/brand/app-icon-light.svg" alt="AIG" width={28} height={28} className="rounded-lg" />
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
                  className={`px-4 py-1.5 rounded-full transition-colors ${
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
              className="group flex items-center gap-2.5 w-56 lg:w-64 h-9 pl-3 pr-2 rounded-xl bg-gray-50/80 ring-1 ring-inset ring-gray-200/80 text-sm text-gray-500 shadow-[inset_0_1px_2px_rgba(17,24,39,0.04)] hover:bg-white hover:ring-indigo-300/70 hover:text-indigo-600 transition-colors cursor-text"
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
                className="flex items-center space-x-2 pl-2 pr-3 py-1 rounded-full text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                aria-haspopup="menu"
                aria-expanded={userMenuOpen}
              >
                <span className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-semibold">
                  {user?.name?.slice(0, 1)?.toUpperCase() ?? "U"}
                </span>
                <span>{user?.name ?? "사용자"}</span>
              </button>
              {userMenuOpen && (
                <div
                  className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50"
                  role="menu"
                  onClick={(e) => e.stopPropagation()}
                >
                  {hydrated && (
                    <button
                      type="button"
                      onClick={() => {
                        toggleTheme();
                        setUserMenuOpen(false);
                      }}
                      className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
                      <span>{theme === "dark" ? "라이트 모드" : "다크 모드"}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setUserMenuOpen(false);
                      void handleLogout();
                    }}
                    className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <LogOut size={16} />
                    <span>로그아웃</span>
                  </button>
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
          className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-start justify-center pt-24 px-4"
          onClick={closePalette}
          role="presentation"
        >
          <div
            className="w-full max-w-lg bg-white rounded-2xl shadow-2xl ring-1 ring-gray-200/70 overflow-hidden"
            role="dialog"
            aria-label="명령 팔레트"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3">
              <div className="flex items-center gap-3 px-3.5 h-11 rounded-xl bg-gray-50 ring-1 ring-inset ring-gray-200/70 shadow-[inset_0_2px_4px_rgba(17,24,39,0.06),inset_0_-1px_0_0_rgba(255,255,255,0.7)] focus-within:ring-indigo-300/70 focus-within:bg-white transition-colors">
                <Search size={16} strokeWidth={2} className="text-gray-400 shrink-0" />
                <input
                  autoFocus
                  className="flex-1 text-sm text-gray-900 placeholder-gray-400 bg-transparent border-0 outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 appearance-none caret-indigo-600"
                  placeholder="검색…"
                  value={paletteQuery}
                  onChange={(e) => {
                    setPaletteQuery(e.target.value);
                    setPaletteIndex(0);
                  }}
                />
                <kbd className="text-[10px] font-semibold text-gray-500 bg-white ring-1 ring-inset ring-gray-200 rounded-md px-1.5 py-0.5 shadow-[0_1px_0_0_rgba(17,24,39,0.04)]">
                  esc
                </kbd>
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto py-2">
              {filteredItems.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-gray-400">결과 없음</div>
              ) : (
                filteredItems.map((item, i) => {
                  const Icon = item.icon;
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
                      className={`w-full flex items-center space-x-3 px-4 py-2.5 text-sm text-left transition-colors ${
                        i === paletteIndex
                          ? "bg-indigo-50 text-indigo-700"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <Icon size={16} strokeWidth={2} className={i === paletteIndex ? "text-indigo-600" : "text-gray-400"} />
                      <span className="flex-1">{item.label}</span>
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

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Sun,
  Moon,
  LogOut,
  Search,
  Palette,
  Check,
  ChevronLeft,
  BookOpen,
  History,
  User as UserIcon,
  Command,
  type LucideIcon,
} from "lucide-react";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { useRouteScope } from "@/components/routing/RouteScopeProvider";
import { THEME_OPTIONS, useDevTheme, type V3ThemeTone } from "@/components/dev/DevThemeContext";
import { authApi } from "@/lib/api/authApi";
import { useAuthStore } from "@/store/authStore";
import { useThemeStore } from "@/store/themeStore";
import { useUiStore } from "@/store/uiStore";

type PaletteItem = {
  id: string;
  label: string;
  href?: string;
  action?: () => void;
  icon: LucideIcon;
};

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  shortcut?: string;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/problems", label: "과제 목록", icon: BookOpen, shortcut: "P" },
  { href: "/sessions", label: "풀이 기록", icon: History, shortcut: "S" },
  { href: "/mypage", label: "마이페이지", icon: UserIcon, shortcut: "M" },
];

const SURFACE_TITLES: Record<string, string> = {
  "/problems": "problems",
  "/sessions": "sessions",
  "/harness": "harness",
  "/mypage": "mypage",
  "/submissions": "submissions",
  "/ide": "ide",
};

function getSurfaceTitle(currentPath: string): string {
  for (const prefix of Object.keys(SURFACE_TITLES)) {
    if (currentPath === prefix || currentPath.startsWith(`${prefix}/`)) {
      return SURFACE_TITLES[prefix];
    }
  }
  return "—";
}

function isFullBleedSurface(pathname: string): boolean {
  return /\/ide(\/|$)/.test(pathname) || /\/harness(\/|$)/.test(pathname);
}

function formatClock(d: Date) {
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

export function DevShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const { currentPath, withPrefix } = useRouteScope();
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const theme = useThemeStore((state) => state.theme);
  const hydrated = useThemeStore((state) => state.hydrated);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const addToast = useUiStore((state) => state.addToast);
  const { themeTone, setThemeTone } = useDevTheme();

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteMode, setPaletteMode] = useState<"main" | "theme">("main");
  const [paletteQuery, setPaletteQuery] = useState("");
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [clock, setClock] = useState<string>(() => formatClock(new Date()));

  const shellRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const id = window.setInterval(() => setClock(formatClock(new Date())), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const openPalette = () => {
    setPaletteOpen(true);
    setPaletteMode("main");
    setPaletteQuery("");
    setPaletteIndex(0);
  };

  const closePalette = () => {
    setPaletteOpen(false);
    setPaletteMode("main");
    setPaletteQuery("");
    setPaletteIndex(0);
  };

  const surface = getSurfaceTitle(currentPath);
  const fullBleed = isFullBleedSurface(pathname);

  const activeNavIndex = useMemo(() => {
    const idx = NAV_ITEMS.findIndex(
      (item) => currentPath === item.href || currentPath.startsWith(`${item.href}/`),
    );
    return idx;
  }, [currentPath]);

  const handleLogout = async () => {
    const { tokens } = useAuthStore.getState();
    if (tokens?.refreshToken) {
      try { await authApi.logout(tokens.refreshToken); } catch { /* 서버 오류여도 로컬 로그아웃 진행 */ }
    }
    signOut();
    addToast("로그아웃되었습니다.", "success");
    router.replace(withPrefix("/login"));
  };

  // Shell-wide magnetic spotlight that follows the cursor
  useEffect(() => {
    const el = shellRef.current;
    if (!el) return;
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        const rect = el.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        el.style.setProperty("--pvxs-mx", `${x}%`);
        el.style.setProperty("--pvxs-my", `${y}%`);
      });
    };
    el.addEventListener("mousemove", onMove);
    return () => {
      el.removeEventListener("mousemove", onMove);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        paletteOpen ? closePalette() : openPalette();
      } else if (e.key === "Escape") {
        if (!paletteOpen) {
          setUserMenuOpen(false);
          return;
        }
        if (paletteMode === "theme") {
          setPaletteMode("main");
          setPaletteQuery("");
          setPaletteIndex(0);
        } else {
          closePalette();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [paletteOpen, paletteMode]);

  const mainItems: PaletteItem[] = useMemo(() => {
    const items: PaletteItem[] = NAV_ITEMS.map((n) => ({
      id: `nav-${n.href}`,
      label: n.label,
      href: n.href,
      icon: n.icon,
    }));
    items.push({
      id: "action-theme-tone",
      label: "테마 색상 선택",
      icon: Palette,
      action: () => {
        setPaletteMode("theme");
        setPaletteQuery("");
        setPaletteIndex(0);
      },
    });
    if (hydrated) {
      items.push({
        id: "action-theme",
        label: theme === "dark" ? "라이트 모드" : "다크 모드",
        icon: theme === "dark" ? Sun : Moon,
        action: () => {
          toggleTheme();
          closePalette();
        },
      });
    }
    items.push({
      id: "action-logout",
      label: "로그아웃",
      icon: LogOut,
      action: () => {
        closePalette();
        void handleLogout();
      },
    });
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, theme]);

  const themeItems: PaletteItem[] = useMemo(() => {
    const back: PaletteItem = {
      id: "theme-back",
      label: "← 뒤로",
      icon: ChevronLeft,
      action: () => {
        setPaletteMode("main");
        setPaletteQuery("");
        setPaletteIndex(0);
      },
    };
    const tones: PaletteItem[] = THEME_OPTIONS.map((opt) => ({
      id: `theme-${opt.id}`,
      label: opt.id === themeTone ? `${opt.label} · 현재` : opt.label,
      icon: opt.id === themeTone ? Check : Palette,
      action: () => {
        setThemeTone(opt.id as V3ThemeTone);
        setPaletteMode("main");
        setPaletteQuery("");
        setPaletteIndex(0);
      },
    }));
    return [back, ...tones];
  }, [themeTone, setThemeTone]);

  const allItems = paletteMode === "theme" ? themeItems : mainItems;

  const filteredItems = useMemo(() => {
    const q = paletteQuery.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter((item) => item.label.toLowerCase().includes(q));
  }, [allItems, paletteQuery]);

  useEffect(() => {
    if (!paletteOpen) return;
    const handler = (e: KeyboardEvent) => {
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
          setPaletteOpen(false);
          router.push(withPrefix(item.href));
        } else if (item.action) {
          item.action();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [paletteOpen, filteredItems, paletteIndex, router, withPrefix]);

  const selectItem = (item: PaletteItem) => {
    if (item.href) {
      closePalette();
      router.push(withPrefix(item.href));
    } else if (item.action) {
      item.action();
    }
  };

  return (
    <div
      className={"pvxs-shell" + (fullBleed ? " pvxs-shell--full" : "")}
      ref={shellRef}
    >
      {/* Shell-wide aurora (shared by sidebar + content) */}
      <div className="pvxs-shell__aurora" aria-hidden>
        <div className="pvxs-shell__blob pvxs-shell__blob--1" />
        <div className="pvxs-shell__blob pvxs-shell__blob--2" />
        <div className="pvxs-shell__blob pvxs-shell__blob--3" />
        <div className="pvxs-shell__grid" />
        <div className="pvxs-shell__spot" />
      </div>

      {!fullBleed ? (
        <aside
          className="pvxs-sidebar"
          ref={sidebarRef}
          onMouseLeave={() => setUserMenuOpen(false)}
        >
          {/* Brand */}
          <Link
            href={withPrefix("/problems")}
            className="pvxs-brand"
            aria-label="AIGround 홈"
          >
            <span className="pvxs-brand__mark">
              <svg width="18" height="18" viewBox="0 0 512 512" fill="none" aria-hidden>
                <g transform="rotate(-7 256 256)">
                  <path d="M164 344L248 176L352 334H164Z" stroke="currentColor" strokeWidth="18" strokeLinejoin="round" />
                  <circle cx="248" cy="176" r="28" stroke="currentColor" strokeWidth="14" />
                  <circle cx="164" cy="344" r="28" stroke="currentColor" strokeWidth="14" />
                  <circle cx="352" cy="334" r="28" stroke="currentColor" strokeWidth="14" />
                </g>
              </svg>
            </span>
            <span className="pvxs-brand__name">AIGround</span>
            <span className="pvxs-brand__tag">dev</span>
          </Link>

          {/* Nav */}
          <nav className="pvxs-nav" aria-label="주 탐색">
            <span
              className="pvxs-nav__indicator"
              style={{
                opacity: activeNavIndex >= 0 ? 1 : 0,
                transform: `translateY(${activeNavIndex >= 0 ? activeNavIndex * 44 : 0}px)`,
              }}
              aria-hidden
            />
            {NAV_ITEMS.map((item, idx) => {
              const active =
                currentPath === item.href || currentPath.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={withPrefix(item.href)}
                  className={"pvxs-nav__item" + (active ? " pvxs-nav__item--active" : "")}
                  aria-current={active ? "page" : undefined}
                  style={{ ["--pvxs-i" as string]: idx }}
                >
                  <Icon size={17} strokeWidth={active ? 2.2 : 1.8} className="pvxs-nav__icon" />
                  <span className="pvxs-nav__label">{item.label}</span>
                  {item.shortcut ? (
                    <kbd className="pvxs-nav__kbd" aria-hidden>
                      {item.shortcut}
                    </kbd>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          {/* Quick row (palette + theme tone + dark toggle) */}
          <div className="pvxs-quick">
            <button
              type="button"
              className="pvxs-quick__palette"
              onClick={openPalette}
              aria-label="명령 팔레트 열기"
            >
              <Command size={15} strokeWidth={2} className="pvxs-quick__icon" />
              <span>검색 및 실행</span>
              <kbd>⌘K</kbd>
            </button>

            <div className="pvxs-quick__row">
              <button
                type="button"
                className="pvxs-quick__btn"
                onClick={() => {
                  setPaletteOpen(true);
                  setPaletteMode("theme");
                  setPaletteQuery("");
                  setPaletteIndex(0);
                }}
                aria-label="테마 색상 선택"
                title="테마 색상"
              >
                <Palette size={15} strokeWidth={1.8} />
                <span>테마</span>
              </button>
              {hydrated ? (
                <button
                  type="button"
                  className="pvxs-quick__btn"
                  onClick={toggleTheme}
                  aria-label={theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"}
                  title={theme === "dark" ? "라이트 모드" : "다크 모드"}
                >
                  {theme === "dark" ? (
                    <Sun size={15} strokeWidth={1.8} />
                  ) : (
                    <Moon size={15} strokeWidth={1.8} />
                  )}
                  <span>{theme === "dark" ? "라이트" : "다크"}</span>
                </button>
              ) : null}
            </div>
          </div>

          {/* User card */}
          <div className="pvxs-user">
            <button
              type="button"
              className="pvxs-user__btn"
              onClick={() => setUserMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={userMenuOpen}
            >
              <span className="pvxs-user__avatar-wrap">
                <span className="pvxs-user__avatar">
                  {user?.name?.slice(0, 1)?.toUpperCase() ?? "U"}
                </span>
                <span className="pvxs-user__status" aria-hidden />
              </span>
              <span className="pvxs-user__meta">
                <span className="pvxs-user__name">{user?.name ?? "사용자"}</span>
                <span className="pvxs-user__role">온라인 · {clock}</span>
              </span>
              <span className="pvxs-user__chev" aria-hidden>
                ⌄
              </span>
            </button>
            {userMenuOpen ? (
              <div
                className="pvxs-user__menu"
                role="menu"
                onClick={(e) => e.stopPropagation()}
              >
                <Link
                  href={withPrefix("/mypage")}
                  className="pvxs-user__menu-item"
                  onClick={() => setUserMenuOpen(false)}
                >
                  <UserIcon size={13} strokeWidth={1.8} />
                  프로필
                </Link>
                <button
                  type="button"
                  className="pvxs-user__menu-item pvxs-user__menu-item--danger"
                  onClick={() => {
                    setUserMenuOpen(false);
                    void handleLogout();
                  }}
                >
                  <LogOut size={13} strokeWidth={1.8} />
                  로그아웃
                </button>
              </div>
            ) : null}
          </div>
        </aside>
      ) : null}

      <div className="pvxs-main">
        <header className="pvxs-topbar">
          <div className="pvxs-topbar__crumb">
            {fullBleed ? (
              <Link
                href={withPrefix("/problems")}
                className="pvxs-topbar__home"
                aria-label="홈"
              >
                <BrandLogo variant="app-icon" height={18} />
              </Link>
            ) : null}
            <span className="pvxs-topbar__slash">/</span>
            <span className="pvxs-topbar__name">{surface}</span>
            <span className="pvxs-topbar__ping" aria-hidden />
          </div>
          <div className="pvxs-topbar__right">
            <button
              type="button"
              className="pvxs-topbar__cmdk"
              onClick={openPalette}
              aria-label="명령 팔레트 열기"
            >
              <Search size={13} strokeWidth={2} />
              <span>이동 또는 검색</span>
              <kbd>⌘K</kbd>
            </button>
          </div>
        </header>

        <main className={"pvxs-content" + (fullBleed ? " pvxs-content--full" : "")}>
          {children}
        </main>
      </div>

      {/* Palette */}
      {paletteOpen ? (
        <div className="pvxs-palette-scrim" onClick={closePalette} role="presentation">
          <div
            className="pvxs-palette"
            role="dialog"
            aria-label="명령 팔레트"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pvxs-palette__head">
              <Search size={15} strokeWidth={2} className="pvxs-palette__head-icon" />
              <input
                autoFocus
                className="pvxs-palette__input"
                placeholder={paletteMode === "theme" ? "테마 선택" : "이동하거나 검색하기"}
                value={paletteQuery}
                onChange={(e) => {
                  setPaletteQuery(e.target.value);
                  setPaletteIndex(0);
                }}
              />
              <kbd className="pvxs-palette__esc">esc</kbd>
            </div>
            <div className="pvxs-palette__list">
              {filteredItems.length === 0 ? (
                <div className="pvxs-palette__empty">결과 없음</div>
              ) : (
                filteredItems.map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <button
                      type="button"
                      key={item.id}
                      className={
                        "pvxs-palette__item" +
                        (i === paletteIndex ? " pvxs-palette__item--active" : "")
                      }
                      onMouseEnter={() => setPaletteIndex(i)}
                      onClick={() => selectItem(item)}
                    >
                      <Icon
                        size={14}
                        strokeWidth={1.8}
                        className="pvxs-palette__item-icon"
                      />
                      <span>{item.label}</span>
                      {i === paletteIndex ? (
                        <span className="pvxs-palette__item-hint" aria-hidden>
                          ↵
                        </span>
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

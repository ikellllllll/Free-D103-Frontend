"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  BookOpen,
  History,
  User,
  FlaskConical,
  TestTube,
  Sun,
  Moon,
  LogOut,
  Search,
  Palette,
  Check,
  ChevronLeft,
  type LucideIcon
} from "lucide-react";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { useRouteScope } from "@/components/routing/RouteScopeProvider";
import { THEME_OPTIONS, useDevTheme, type V3ThemeTone } from "@/components/dev/DevThemeContext";
import { mockApi } from "@/lib/api/mockApi";
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

const NAV_ITEMS: { href: string; icon: LucideIcon; label: string }[] = [
  { href: "/problems", icon: BookOpen, label: "과제 목록" },
  { href: "/sessions", icon: History, label: "풀이 기록" },
  { href: "/workshop", icon: FlaskConical, label: "워크숍" },
  { href: "/harness", icon: TestTube, label: "하네스" },
  { href: "/mypage", icon: User, label: "마이페이지" }
];

const SURFACE_TITLES: Record<string, string> = {
  "/problems": "problems",
  "/sessions": "sessions",
  "/workshop": "workshop",
  "/harness": "harness",
  "/mypage": "mypage",
  "/submissions": "submissions",
  "/ide": "ide"
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
  // IDE always needs full canvas; submissions/[id]/timeline can use it too
  return /\/ide(\/|$)/.test(pathname);
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

  const handleLogout = async () => {
    await mockApi.logout();
    signOut();
    addToast("로그아웃되었습니다.", "success");
    router.replace(withPrefix("/login"));
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        if (paletteOpen) {
          closePalette();
        } else {
          openPalette();
        }
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
      icon: n.icon
    }));
    items.push({
      id: "action-theme-tone",
      label: "테마 색상 선택",
      icon: Palette,
      action: () => {
        setPaletteMode("theme");
        setPaletteQuery("");
        setPaletteIndex(0);
      }
    });
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
      }
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
      }
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
    <div className={"dev-shell" + (fullBleed ? " dev-shell--full" : "")}>
      {!fullBleed ? (
      <aside className="dev-sidebar">
        <Link
          href={withPrefix("/problems")}
          className="dev-sidebar__brand"
          aria-label="AIG 홈"
        >
          <BrandLogo variant="app-icon" height={22} />
          <BrandLogo variant="primary-word" height={14} className="dev-sidebar__brand-word" />
        </Link>

        <nav className="dev-sidebar__nav" aria-label="주 탐색">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active =
              currentPath === item.href || currentPath.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={withPrefix(item.href)}
                className={
                  "dev-sidebar__nav-item" +
                  (active ? " dev-sidebar__nav-item--active" : "")
                }
                aria-current={active ? "page" : undefined}
              >
                <Icon size={16} strokeWidth={1.8} />
                <span className="dev-sidebar__nav-label">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="dev-sidebar__foot">
          <button
            type="button"
            className="dev-sidebar__palette-cta"
            onClick={openPalette}
          >
            <Search size={13} strokeWidth={2} />
            <span>찾기</span>
            <kbd>⌘K</kbd>
          </button>

          <div className="dev-sidebar__user">
            <button
              type="button"
              className="dev-sidebar__user-btn"
              onClick={() => setUserMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={userMenuOpen}
            >
              <span className="dev-sidebar__user-avatar">
                {user?.name?.slice(0, 1)?.toUpperCase() ?? "U"}
              </span>
              <span className="dev-sidebar__user-name">{user?.name ?? "사용자"}</span>
            </button>
            {userMenuOpen ? (
              <div
                className="dev-sidebar__user-menu"
                role="menu"
                onClick={(e) => e.stopPropagation()}
              >
                {hydrated ? (
                  <button
                    type="button"
                    className="dev-sidebar__user-menu-item"
                    onClick={() => {
                      toggleTheme();
                    }}
                  >
                    {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
                    {theme === "dark" ? "라이트 모드" : "다크 모드"}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="dev-sidebar__user-menu-item"
                  onClick={() => {
                    setUserMenuOpen(false);
                    void handleLogout();
                  }}
                >
                  <LogOut size={14} />
                  로그아웃
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </aside>
      ) : null}

      <div className="dev-main">
        <header className="dev-topbar">
          <div className="dev-topbar__crumb">
            {fullBleed ? (
              <Link
                href={withPrefix("/problems")}
                className="dev-topbar__home"
                aria-label="AIG 홈"
              >
                <BrandLogo variant="app-icon" height={18} />
              </Link>
            ) : null}
            <span className="dev-topbar__crumb-mark">/</span>
            <span className="dev-topbar__crumb-name">{surface}</span>
          </div>
          <div className="dev-topbar__right">
            {fullBleed ? (
              <button
                type="button"
                className="dev-topbar__quick"
                onClick={openPalette}
                title="명령 팔레트 (⌘K)"
                aria-label="명령 팔레트 열기"
              >
                <Search size={14} strokeWidth={2} />
                <kbd>⌘K</kbd>
              </button>
            ) : null}
          </div>
        </header>

        <main
          className={
            "dev-content" + (fullBleed ? " dev-content--full" : "")
          }
        >
          {children}
        </main>
      </div>

      {paletteOpen ? (
        <div
          className="dev-palette-scrim"
          onClick={closePalette}
          role="presentation"
        >
          <div
            className="dev-palette"
            role="dialog"
            aria-label="명령 팔레트"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dev-palette__head">
              {paletteMode === "theme" ? (
                <Palette size={16} strokeWidth={2} />
              ) : (
                <Search size={16} strokeWidth={2} />
              )}
              <input
                autoFocus
                className="dev-palette__input"
                placeholder={paletteMode === "theme" ? "테마 색상 선택" : "찾기"}
                value={paletteQuery}
                onChange={(e) => {
                  setPaletteQuery(e.target.value);
                  setPaletteIndex(0);
                }}
              />
              <kbd className="dev-palette__esc">esc</kbd>
            </div>
            <div className="dev-palette__list">
              {filteredItems.length === 0 ? (
                <div className="dev-palette__empty">없음</div>
              ) : (
                filteredItems.map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <button
                      type="button"
                      key={item.id}
                      className={
                        "dev-palette__item" +
                        (i === paletteIndex ? " dev-palette__item--active" : "")
                      }
                      onMouseEnter={() => setPaletteIndex(i)}
                      onClick={() => selectItem(item)}
                    >
                      <span className="dev-palette__item-icon">
                        <Icon size={15} strokeWidth={1.8} />
                      </span>
                      <span className="dev-palette__item-label">{item.label}</span>
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

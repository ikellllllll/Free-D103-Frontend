"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { usePathname } from "next/navigation";

interface RouteScopeValue {
  prefix: string;
}

const RouteScopeContext = createContext<RouteScopeValue>({ prefix: "" });

function normalizePrefix(prefix: string) {
  if (!prefix || prefix === "/") {
    return "";
  }

  return prefix.startsWith("/") ? prefix.replace(/\/+$/, "") : `/${prefix.replace(/\/+$/, "")}`;
}

export function withRoutePrefix(prefix: string, href: string) {
  if (!href.startsWith("/")) {
    return href;
  }

  const normalizedPrefix = normalizePrefix(prefix);

  if (!normalizedPrefix) {
    return href;
  }

  if (href === normalizedPrefix || href.startsWith(`${normalizedPrefix}/`)) {
    return href;
  }

  return href === "/" ? normalizedPrefix : `${normalizedPrefix}${href}`;
}

export function stripRoutePrefix(prefix: string, pathname: string) {
  const normalizedPrefix = normalizePrefix(prefix);

  if (!normalizedPrefix || !pathname) {
    return pathname || "/";
  }

  if (pathname === normalizedPrefix) {
    return "/";
  }

  if (pathname.startsWith(`${normalizedPrefix}/`)) {
    return pathname.slice(normalizedPrefix.length) || "/";
  }

  return pathname;
}

export function RouteScopeProvider({ prefix, children }: { prefix: string; children: ReactNode }) {
  const value = useMemo<RouteScopeValue>(() => ({ prefix: normalizePrefix(prefix) }), [prefix]);

  return <RouteScopeContext.Provider value={value}>{children}</RouteScopeContext.Provider>;
}

export function useRouteScope() {
  const { prefix } = useContext(RouteScopeContext);
  const pathname = usePathname() ?? "/";
  const currentPath = stripRoutePrefix(prefix, pathname);

  return {
    prefix,
    currentPath,
    withPrefix: (href: string) => withRoutePrefix(prefix, href),
    isCurrentPath: (href: string) => {
      const targetPath = stripRoutePrefix(prefix, href);
      // targetPath === "/" 의 special case: 모든 절대경로가 "/" 로 시작하므로 startsWith("/") 가
      // 무조건 true → 어떤 페이지에서든 home 메뉴가 active 로 강조되는 버그. strict 일치만 허용.
      if (targetPath === "/") return currentPath === "/";
      return currentPath === targetPath || currentPath.startsWith(`${targetPath}/`);
    }
  };
}

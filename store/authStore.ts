"use client";

import { create } from "zustand";

import type { AuthUser } from "@/lib/types/auth";

const STORAGE_KEY = "aig-auth-user";
const TOKEN_KEY = "aig-auth-tokens";
const LEGACY_STORAGE_KEY = "ait-auth-user";

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthState {
  user: AuthUser | null;
  tokens: AuthTokens | null;
  hydrated: boolean;
  hydrate: () => void;
  signIn: (user: AuthUser, tokens: AuthTokens) => void;
  signOut: () => void;
  setTokens: (tokens: AuthTokens) => void;
  setUser: (patch: Partial<AuthUser>) => void;
}

/** localStorage 값을 안전하게 JSON.parse — 실패하면 키를 지우고 null 반환.
 * corrupt JSON 이 hydrate 단계에서 throw 되면 hydrated=true 가 안 돼 AuthGate 가
 * "세션 확인 중" 으로 무한히 멈추던 버그 방지. */
const safeParse = <T,>(raw: string | null, removeOnFail?: string): T | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    if (removeOnFail && typeof window !== "undefined") {
      try { window.localStorage.removeItem(removeOnFail); } catch { /* noop */ }
    }
    return null;
  }
};

/** localStorage 쓰기 — quota / security 예외 흡수 (incognito, 디스크 풀 등). */
const safeWrite = (key: string, value: string) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* noop — sign-in 흐름이 storage 예외로 중단되지 않도록 */
  }
};

const safeRemove = (key: string) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* noop */
  }
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  tokens: null,
  hydrated: false,
  hydrate: () => {
    if (typeof window === "undefined") {
      return;
    }

    const rawUser = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_STORAGE_KEY);
    const rawTokens = window.localStorage.getItem(TOKEN_KEY);
    const user = safeParse<AuthUser>(rawUser, STORAGE_KEY);
    const tokens = safeParse<AuthTokens>(rawTokens, TOKEN_KEY);

    set({
      user,
      tokens,
      hydrated: true
    });

    // 멀티탭 sync: 다른 탭에서 sign-in/sign-out/token refresh 가 일어나면 storage event 가
    // 발화한다. 이를 받아 현재 탭 zustand state 도 갱신해서, 오래 열어 둔 탭이 stale token 으로
    // signOut 되는 케이스 방지. 한 번만 등록 (hydrate 가 멱등하지 않으면 cleanup 주체가 모호하니
    // 글로벌로 한 번만 등록되도록 flag 사용).
    if (!hydratedStorageListenerRef.attached) {
      window.addEventListener("storage", (event) => {
        if (event.storageArea !== window.localStorage) return;
        if (event.key === TOKEN_KEY) {
          const nextTokens = safeParse<AuthTokens>(event.newValue, TOKEN_KEY);
          set({ tokens: nextTokens });
        } else if (event.key === STORAGE_KEY) {
          const nextUser = safeParse<AuthUser>(event.newValue, STORAGE_KEY);
          set({ user: nextUser });
        } else if (event.key === null) {
          // localStorage.clear() 호출 시 key 가 null. 전체 sign-out 으로 간주.
          set({ user: null, tokens: null });
        }
      });
      hydratedStorageListenerRef.attached = true;
    }
    // get() 은 동시성 가드용. 추후 race 케이스 대비 placeholder.
    void get;
  },
  signIn: (user, tokens) => {
    safeWrite(STORAGE_KEY, JSON.stringify(user));
    safeWrite(TOKEN_KEY, JSON.stringify(tokens));
    set({ user, tokens });
  },
  signOut: () => {
    safeRemove(STORAGE_KEY);
    safeRemove(TOKEN_KEY);
    set({ user: null, tokens: null });
  },
  setTokens: (tokens) => {
    safeWrite(TOKEN_KEY, JSON.stringify(tokens));
    set({ tokens });
  },
  setUser: (patch) => {
    set((state) => {
      if (!state.user) return state;
      const next = { ...state.user, ...patch };
      safeWrite(STORAGE_KEY, JSON.stringify(next));
      return { user: next };
    });
  }
}));

// 글로벌 storage 리스너가 한 번만 붙도록 가드하는 ref. 모듈 스코프라 HMR 시에도 안전.
const hydratedStorageListenerRef = { attached: false };

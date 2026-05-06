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

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  tokens: null,
  hydrated: false,
  hydrate: () => {
    if (typeof window === "undefined") {
      return;
    }

    const rawUser = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_STORAGE_KEY);
    const rawTokens = window.localStorage.getItem(TOKEN_KEY);
    set({
      user: rawUser ? (JSON.parse(rawUser) as AuthUser) : null,
      tokens: rawTokens ? (JSON.parse(rawTokens) as AuthTokens) : null,
      hydrated: true
    });
  },
  signIn: (user, tokens) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      window.localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
    }
    set({ user, tokens });
  },
  signOut: () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(TOKEN_KEY);
    }
    set({ user: null, tokens: null });
  },
  setTokens: (tokens) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
    }
    set({ tokens });
  },
  setUser: (patch) => {
    set((state) => {
      if (!state.user) return state;
      const next = { ...state.user, ...patch };
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      }
      return { user: next };
    });
  }
}));

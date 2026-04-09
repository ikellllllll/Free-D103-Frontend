"use client";

import { create } from "zustand";

import type { AuthUser } from "@/lib/types/auth";

const STORAGE_KEY = "aig-auth-user";
const LEGACY_STORAGE_KEY = "ait-auth-user";

interface AuthState {
  user: AuthUser | null;
  hydrated: boolean;
  hydrate: () => void;
  signIn: (user: AuthUser) => void;
  signOut: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  hydrated: false,
  hydrate: () => {
    if (typeof window === "undefined") {
      return;
    }

    const raw = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_STORAGE_KEY);
    set({
      user: raw ? (JSON.parse(raw) as AuthUser) : null,
      hydrated: true
    });
  },
  signIn: (user) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    }
    set({ user });
  },
  signOut: () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    set({ user: null });
  }
}));

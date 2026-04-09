"use client";

import { create } from "zustand";

export interface ToastItem {
  id: string;
  message: string;
  severity: "success" | "error" | "warning" | "info";
}

interface UiState {
  toasts: ToastItem[];
  addToast: (message: string, severity?: ToastItem["severity"]) => void;
  removeToast: (id: string) => void;
}

const uid = () => `toast-${Math.random().toString(36).slice(2, 10)}`;

export const useUiStore = create<UiState>((set, get) => ({
  toasts: [],
  addToast: (message, severity = "info") => {
    const id = uid();
    set((state) => ({
      toasts: [...state.toasts, { id, message, severity }]
    }));

    window.setTimeout(() => {
      get().removeToast(id);
    }, 3200);
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id)
    }))
}));

"use client";

import { useUiStore } from "@/store/uiStore";

export function ToastViewport() {
  const toasts = useUiStore((state) => state.toasts);

  return (
    <div className="toast-viewport">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast--${toast.severity}`}>
          {toast.message}
        </div>
      ))}
    </div>
  );
}

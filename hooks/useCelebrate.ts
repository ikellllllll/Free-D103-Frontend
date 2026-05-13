"use client";

import { useCallback, useRef } from "react";

/**
 * 정답/모든 테스트 통과 시 폭죽 + 색종이 효과.
 *
 * - canvas-confetti 를 dynamic import (SSR 회피).
 * - 같은 key (예: executionId) 로는 한 번만 발사 — 중복 트리거 방지.
 * - 한 번 발사 시: 좌/우 양쪽에서 3초 동안 색종이 + 중앙 폭죽 burst 3회.
 */
export function useCelebrate() {
  // 같은 key 는 한 번만 — refire 방지.
  const firedKeysRef = useRef<Set<string>>(new Set());

  const fire = useCallback(async (key: string = "default") => {
    if (firedKeysRef.current.has(key)) return;
    firedKeysRef.current.add(key);

    if (typeof window === "undefined") return;
    const mod = await import("canvas-confetti").catch(() => null);
    if (!mod) return;
    const confetti = mod.default;

    // 중앙 폭죽 burst — 3번 약간 시간차로
    const center = (delay: number) => {
      window.setTimeout(() => {
        confetti({
          particleCount: 120,
          spread: 75,
          startVelocity: 50,
          origin: { x: 0.5, y: 0.55 },
          scalar: 1.1,
          zIndex: 9999
        });
      }, delay);
    };
    center(0);
    center(220);
    center(440);

    // 좌·우 사이드 흩뿌리기 (3초)
    const end = Date.now() + 3000;
    const sides = () => {
      confetti({
        particleCount: 6,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        zIndex: 9999
      });
      confetti({
        particleCount: 6,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        zIndex: 9999
      });
      if (Date.now() < end) {
        window.requestAnimationFrame(sides);
      }
    };
    sides();
  }, []);

  return { fire };
}

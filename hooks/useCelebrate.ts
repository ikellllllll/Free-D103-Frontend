"use client";

import { useCallback, useEffect, useRef } from "react";

const CELEBRATION_PHRASES = [
  "국밥이네요",
  "성장했습니다",
  "정말 좋았습니다",
  "맞았습니다!!",
  "멋진 풀이",
  "공부 많이 된다",
  "대화가 된다",
  "예술이다 예술",
];

const ANIMATION_STYLE_ID = "celebrate-phrase-anim";

function ensureAnimationStyle() {
  if (document.getElementById(ANIMATION_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = ANIMATION_STYLE_ID;
  style.textContent = `
    @keyframes celebrate-in {
      0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.6); }
      20%  { opacity: 1; transform: translate(-50%, -50%) scale(1.08); }
      35%  { transform: translate(-50%, -50%) scale(0.97); }
      50%  { transform: translate(-50%, -50%) scale(1); }
      80%  { opacity: 1; transform: translate(-50%, -50%) scale(1); }
      100% { opacity: 0; transform: translate(-50%, -50%) scale(0.85); }
    }
  `;
  document.head.appendChild(style);
}

function showCelebrationPhrase(durationMs: number) {
  ensureAnimationStyle();

  const phrase = CELEBRATION_PHRASES[Math.floor(Math.random() * CELEBRATION_PHRASES.length)];

  const overlay = document.createElement("div");
  overlay.style.cssText = [
    "position:fixed",
    "inset:0",
    "pointer-events:none",
    "z-index:10000",
  ].join(";");

  const box = document.createElement("div");
  box.textContent = phrase;
  box.style.cssText = [
    "position:absolute",
    "top:42%",
    "left:50%",
    "transform:translate(-50%,-50%)",
    "color:#fff",
    "font-size:clamp(1.8rem,5vw,3.2rem)",
    "font-weight:900",
    "letter-spacing:-0.02em",
    "text-shadow:0 2px 24px rgba(79,70,229,0.7),0 1px 4px rgba(0,0,0,0.4)",
    "white-space:nowrap",
    `animation:celebrate-in ${durationMs}ms cubic-bezier(0.34,1.56,0.64,1) forwards`,
  ].join(";");

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  window.setTimeout(() => overlay.remove(), durationMs + 100);
}

/**
 * 정답/모든 테스트 통과 시 폭죽 + 색종이 + 랜덤 축하 문구.
 *
 * - canvas-confetti 를 dynamic import (SSR 회피).
 * - 같은 key (예: executionId) 로는 한 번만 발사 — 중복 트리거 방지.
 * - 한 번 발사 시: 좌/우 양쪽에서 3초 동안 색종이 + 중앙 폭죽 burst 3회.
 *
 * cleanup: 컴포넌트 unmount 시 진행 중인 setTimeout/requestAnimationFrame 모두 정리해서
 * 페이지 이탈 후 3초 동안 confetti 작업이 계속되는 leak 차단.
 */
export function useCelebrate() {
  const firedKeysRef = useRef<Set<string>>(new Set());
  const timeoutIdsRef = useRef<Set<number>>(new Set());
  const rafIdRef = useRef<number | null>(null);
  const cancelledRef = useRef<boolean>(false);

  useEffect(() => {
    cancelledRef.current = false;
    const timeouts = timeoutIdsRef.current;
    return () => {
      cancelledRef.current = true;
      timeouts.forEach((id) => window.clearTimeout(id));
      timeouts.clear();
      if (rafIdRef.current != null) {
        window.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, []);

  const fire = useCallback(async (key: string = "default") => {
    if (firedKeysRef.current.has(key)) return;
    firedKeysRef.current.add(key);

    if (typeof window === "undefined") return;
    const mod = await import("canvas-confetti").catch(() => null);
    if (!mod || cancelledRef.current) return;
    const confetti = mod.default;

    const CONFETTI_DURATION = 3000;

    // 축하 문구 오버레이 (폭죽과 같은 시간)
    showCelebrationPhrase(CONFETTI_DURATION + 400);

    // 중앙 폭죽 burst — 3번 약간 시간차로 (id 보관 후 cleanup 시 clear)
    const center = (delay: number) => {
      const id = window.setTimeout(() => {
        timeoutIdsRef.current.delete(id);
        if (cancelledRef.current) return;
        confetti({
          particleCount: 120,
          spread: 75,
          startVelocity: 50,
          origin: { x: 0.5, y: 0.55 },
          scalar: 1.1,
          zIndex: 9999
        });
      }, delay);
      timeoutIdsRef.current.add(id);
    };
    center(0);
    center(220);
    center(440);

    // 좌·우 사이드 흩뿌리기 (3초). cancelled 면 즉시 종료, 안 그러면 raf 로 계속.
    const end = Date.now() + CONFETTI_DURATION;
    const sides = () => {
      if (cancelledRef.current) {
        rafIdRef.current = null;
        return;
      }
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
        rafIdRef.current = window.requestAnimationFrame(sides);
      } else {
        rafIdRef.current = null;
      }
    };
    sides();
  }, []);

  return { fire };
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Docker 배포를 위한 standalone 출력 (이미지 크기 ~50MB로 경량화)
  output: "standalone",

  /**
   * 기본 보안 헤더.
   *
   * 트레이드오프 노트:
   *  - localStorage 에 access/refresh 토큰을 둔 상태라 XSS 한 방으로 토큰 탈취 가능. CSP 가
   *    1차 방어선 — script-src 를 self 로 제한하면 모르는 origin 의 inline/3rd-party 스크립트
   *    실행을 막는다. Next.js 의 inline 스크립트(레이아웃 inline theme script 등)는 'unsafe-inline'
   *    필요. 추후 nonce 도입하면 'unsafe-inline' 제거 가능.
   *  - X-Frame-Options=DENY: clickjacking 방지. 우리 앱은 iframe 임베드 의도 없음.
   *  - Referrer-Policy=strict-origin-when-cross-origin: 외부 링크 클릭 시 쿼리스트링 누수 방지.
   *  - X-Content-Type-Options=nosniff: MIME sniffing 차단.
   *  - Permissions-Policy: 안 쓰는 강력 권한 거부 (geolocation/microphone/camera 등).
   *  - HSTS: HTTPS 전용 강제. 현재는 reverse proxy 가 처리할 수도 있어서 includeSubDomains 만 명시.
   */
  async headers() {
    const isProd = process.env.NODE_ENV === "production";
    // dev 에서는 react-refresh / next dev overlay 가 eval / inline 등을 광범위하게 쓰므로
    // 엄격한 CSP 를 적용하면 화면이 깨진다. prod 빌드에서만 적용.
    const csp = isProd
      ? [
          "default-src 'self'",
          // Next.js 가 chunk 마다 inline boot script 를 박는 구조라 unsafe-inline 불가피.
          // 추후 nonce 미들웨어 도입 시 제거.
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: https:",
          "font-src 'self' data:",
          "connect-src 'self' https: wss:",
          // Monaco 가 web worker 를 쓰지만 우리 빌드에서는 비활성. 켜질 때 다시 점검.
          "worker-src 'self' blob:",
          "frame-ancestors 'none'",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'"
        ].join("; ")
      : null;

    const headers = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), interest-cohort=()"
      },
      {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains"
      }
    ];
    if (csp) headers.push({ key: "Content-Security-Policy", value: csp });

    return [
      {
        source: "/:path*",
        headers
      }
    ];
  }
};

export default nextConfig;

import type { Metadata } from "next";
import { IBM_Plex_Sans_KR, Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";

import { RouteScopeProvider } from "@/components/routing/RouteScopeProvider";

import "./globals.css";
import Providers from "./providers";

const sans = IBM_Plex_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans"
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-mono"
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter"
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-space-grotesk"
});

export const metadata: Metadata = {
  title: "AIG | AI-based Integrated Ground",
  description: "AIG 프론트 과제 워크스페이스 프로토타입",
  icons: {
    icon: "/icon.svg"
  }
};

const devtoolsEnabled = process.env.NEXT_PUBLIC_AIG_DEVTOOLS_ENABLED === "true";
const devtoolsBaseUrl = (process.env.NEXT_PUBLIC_AIG_DEVTOOLS_BASE_URL ?? "/_aig").replace(/\/+$/, "");

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => {
              try {
                const stored = localStorage.getItem('aig-theme-mode') ?? localStorage.getItem('ait-theme-mode');
                const theme = stored === 'light' || stored === 'dark'
                  ? stored
                  : (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
                document.documentElement.dataset.theme = theme;
              } catch (error) {}
            })();`
          }}
        />
        {devtoolsEnabled ? (
          <script
            src={`${devtoolsBaseUrl}/bootstrap.js`}
            defer
            data-pyanchor-token={process.env.NEXT_PUBLIC_PYANCHOR_TOKEN ?? ""}
            data-pyanchor-trusted-hosts="studio.pyan.kr,studio-ai.pyan.kr"
          />
        ) : null}
      </head>
      <body className={`${sans.variable} ${mono.variable} ${inter.variable} ${spaceGrotesk.variable}`}>
        <Providers>
          <RouteScopeProvider prefix="">{children}</RouteScopeProvider>

          <div className="mobile-warning">
            <div className="mobile-warning__panel">
              <strong>AIG 화면은 데스크톱 환경에 맞춰 설계되어 있습니다.</strong>
              <span>과제, IDE, 리포트 레이아웃은 넓은 화면에서 확인하는 편이 더 정확합니다.</span>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}

import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-space-grotesk)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"]
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(circle at top center, var(--tw-gradient-stops))"
      }
    }
  },
  // 기존 vanilla CSS reset과 충돌 방지를 위해 preflight 비활성화
  corePlugins: {
    preflight: false
  }
};

export default config;

import Link from "next/link";
import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";

export default function Dev2AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen bg-[#0F0F2E] font-sans flex flex-col overflow-hidden text-white">
      {/* Floating cosmic orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-24 -left-32 w-[520px] h-[520px] rounded-full bg-violet-500/40 blur-3xl animate-blob-1" />
        <div className="absolute top-[8%] left-[22%] w-[160px] h-[160px] rounded-full bg-violet-400/50 blur-2xl animate-float" />
        <div className="absolute top-[30%] -right-32 w-[480px] h-[480px] rounded-full bg-teal-400/30 blur-3xl animate-blob-2" />
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.15]" />
      </div>

      <header className="relative px-6 py-5 animate-fade-in z-10">
        <Link
          href="/dev2"
          className="inline-flex items-center space-x-2 text-white font-display font-bold text-xl group"
        >
          <Sparkles
            size={22}
            strokeWidth={2}
            className="animate-dot-pulse group-hover:animate-spin transition-transform"
          />
          <span>AIG</span>
        </Link>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-6 py-12">
        {children}
      </main>
    </div>
  );
}

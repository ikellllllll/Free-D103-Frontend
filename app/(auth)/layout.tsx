import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

export default function Dev2AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen bg-[#0F0F2E] font-sans flex flex-col overflow-hidden text-white">
      {/* Background grid */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.15]" />
      </div>

      <header className="relative px-6 py-4 animate-fade-in z-10">
        <Link
          href="/"
          className="inline-flex items-center space-x-2 text-white font-display font-bold text-xl group"
        >
          <Image src="/brand/favicon.png" alt="AIG" width={28} height={28} className="rounded-lg object-cover" />
          <span>AIG</span>
        </Link>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-6 py-4">
        {children}
      </main>
    </div>
  );
}

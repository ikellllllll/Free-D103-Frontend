import Link from "next/link";
import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";

export default function Dev2AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 font-sans flex flex-col overflow-hidden">
      {/* Floating blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="orbit-blob w-[500px] h-[500px] bg-indigo-300/40 top-[-100px] left-[-120px] animate-blob-1" />
        <div className="orbit-blob w-[500px] h-[500px] bg-purple-300/40 bottom-[-150px] right-[-140px] animate-blob-2" />
        <div className="absolute inset-0 bg-grid-pattern opacity-30" />
      </div>

      <header className="relative px-6 py-5 animate-fade-in">
        <Link href="/dev2" className="inline-flex items-center space-x-2 text-indigo-600 font-display font-bold text-xl group">
          <Sparkles size={22} strokeWidth={2} className="animate-dot-pulse group-hover:animate-spin transition-transform" />
          <span>AIG</span>
        </Link>
      </header>
      <main className="relative flex-1 flex items-center justify-center px-6 py-12">
        {children}
      </main>
    </div>
  );
}

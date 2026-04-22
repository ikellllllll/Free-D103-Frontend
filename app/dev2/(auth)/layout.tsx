import Link from "next/link";
import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";

export default function Dev2AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 font-sans flex flex-col">
      <header className="px-6 py-5">
        <Link href="/dev2" className="inline-flex items-center space-x-2 text-indigo-600 font-display font-bold text-xl">
          <Sparkles size={22} strokeWidth={2} />
          <span>AIG</span>
        </Link>
      </header>
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        {children}
      </main>
    </div>
  );
}

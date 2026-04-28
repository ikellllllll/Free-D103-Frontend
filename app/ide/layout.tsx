import type { ReactNode } from "react";

import { AuthGate } from "@/components/auth/AuthGate";

export default function Dev2IdeLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <div className="ide-theme-blue">{children}</div>
    </AuthGate>
  );
}

import type { ReactNode } from "react";

import { AuthGate } from "@/components/auth/AuthGate";
import { Dev2Shell } from "@/components/dev2/Dev2Shell";

export default function Dev2MainLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <Dev2Shell>{children}</Dev2Shell>
    </AuthGate>
  );
}

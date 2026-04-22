import type { ReactNode } from "react";

import { RouteScopeProvider } from "@/components/routing/RouteScopeProvider";

export default function Dev2Layout({ children }: { children: ReactNode }) {
  return (
    <RouteScopeProvider prefix="/dev2">
      <div className="dev2-root">{children}</div>
    </RouteScopeProvider>
  );
}

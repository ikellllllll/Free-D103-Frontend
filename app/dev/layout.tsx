import { RouteScopeProvider } from "@/components/routing/RouteScopeProvider";

export default function DevLayout({ children }: { children: React.ReactNode }) {
  return (
    <RouteScopeProvider prefix="/dev">
      <div className="design-dev">{children}</div>
    </RouteScopeProvider>
  );
}

import { AuthGate } from "@/components/auth/AuthGate";
import { AppSidebar } from "@/components/layout/AppSidebar";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <div className="app-shell">
        <AppSidebar />
        <main className="page-shell">{children}</main>
      </div>
    </AuthGate>
  );
}

import { AuthGate } from "@/components/auth/AuthGate";
import { AppSidebar } from "@/components/layout/AppSidebar";

export default function DevMainLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <div className="app-shell app-shell--dev">
        <AppSidebar />
        <main className="page-shell page-shell--dev">{children}</main>
      </div>
    </AuthGate>
  );
}

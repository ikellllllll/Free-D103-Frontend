import { AuthGate } from "@/components/auth/AuthGate";
import { DevShell } from "@/components/dev/DevShell";

export default function DevMainLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <DevShell>{children}</DevShell>
    </AuthGate>
  );
}

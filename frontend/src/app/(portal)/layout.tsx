import { PortalGuard } from "@/features/auth";
import { PortalShell } from "@/widgets/portal-shell";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalGuard>
      <PortalShell>{children}</PortalShell>
    </PortalGuard>
  );
}

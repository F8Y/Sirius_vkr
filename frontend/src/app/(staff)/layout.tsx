import { StaffGuard } from "@/features/auth";

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return <StaffGuard>{children}</StaffGuard>;
}

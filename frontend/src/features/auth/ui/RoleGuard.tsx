"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { hasRole, homePathFor, useAuth, type RoleName } from "@/entities/session";

/**
 * Generic contour gate. Only a user holding one of ``allow`` may pass; an
 * unauthenticated visitor is redirected to /login, a logged-in user without the
 * role is bounced to their own home contour (no dead ends). Modelled on
 * AdminGuard, parameterised by role set.
 */
export function RoleGuard({ allow, children }: { allow: RoleName[]; children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const allowed = hasRole(user, ...allow);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    } else if (!allowed) {
      router.replace(homePathFor(user));
    }
  }, [loading, user, allowed, router]);

  if (loading) return <FullScreenNote text="Загрузка…" />;
  if (!user) return <FullScreenNote text="Требуется вход. Перенаправление…" />;
  if (!allowed) return <FullScreenNote text="Перенаправление в ваш кабинет…" />;
  return <>{children}</>;
}

function FullScreenNote({ text }: { text: string }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--text-secondary)",
        fontSize: "0.95rem",
        padding: "24px",
        textAlign: "center",
      }}
    >
      {text}
    </div>
  );
}

export function PortalGuard({ children }: { children: React.ReactNode }) {
  return <RoleGuard allow={["child", "parent"]}>{children}</RoleGuard>;
}

export function StaffGuard({ children }: { children: React.ReactNode }) {
  return <RoleGuard allow={["teacher", "admin"]}>{children}</RoleGuard>;
}

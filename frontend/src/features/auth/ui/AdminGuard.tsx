"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isAdmin, useAuth } from "@/entities/session";

/**
 * Gate for the /admin/* contour: only an authenticated admin may pass.
 * Anyone else is redirected to /login; a logged-in non-admin sees a refusal.
 */
export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading) {
    return <FullScreenNote text="Загрузка…" />;
  }
  if (!user) {
    return <FullScreenNote text="Требуется вход. Перенаправление…" />;
  }
  if (!isAdmin(user)) {
    return (
      <FullScreenNote text="Недостаточно прав: контур доступен только администратору безопасности." />
    );
  }
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

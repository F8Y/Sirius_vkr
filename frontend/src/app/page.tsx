"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { homePathFor, useAuth } from "@/entities/session";

/**
 * Entry point: wait for the restored session, then route to the role's home
 * contour (admin/teacher/portal). Unauthenticated visitors go to /login.
 */
export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? homePathFor(user) : "/login");
  }, [user, loading, router]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--text-secondary)",
      }}
    >
      Загрузка…
    </div>
  );
}

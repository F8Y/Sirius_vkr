"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/entities/session";
import { AdminSidebar } from "./AdminSidebar";

interface AdminShellProps {
  eyebrow?: string;
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

/** Admin contour frame: grouped sidebar + page header (title + account) + content. */
export function AdminShell({ eyebrow, title, actions, children }: AdminShellProps) {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  const initial = (user?.email?.[0] ?? "А").toUpperCase();

  return (
    <div className="layout-container">
      <AdminSidebar />

      <main className="main-content">
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <div>
            <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
              {eyebrow ?? "Контур администратора безопасности"}
            </span>
            <h2 style={{ fontSize: "1.5rem", fontWeight: 800 }}>{title}</h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            {actions}
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>Администратор</div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                {user?.email ?? "—"}
              </div>
            </div>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                backgroundColor: "var(--color-primary-blue)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "bold",
              }}
            >
              {initial}
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="btn"
              style={{
                width: "auto",
                backgroundColor: "transparent",
                border: "1px solid var(--border-color)",
                color: "var(--text-secondary)",
              }}
            >
              Выйти
            </button>
          </div>
        </header>

        {children}
      </main>
    </div>
  );
}

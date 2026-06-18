"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { isAdmin, useAuth } from "@/entities/session";

interface NavGroup {
  title: string;
  accent?: boolean;
  links: { label: string; href: string }[];
}

const TEACHING: NavGroup[] = [
  {
    title: "Обзор",
    links: [
      { label: "Дашборд", href: "/teacher" },
      { label: "Аналитика", href: "/teacher/analytics" },
    ],
  },
  {
    title: "Обучение",
    links: [
      { label: "Успеваемость", href: "/teacher/students" },
      { label: "Мои курсы", href: "/teacher/courses" },
      { label: "Группы", href: "/teacher/groups" },
      { label: "Расписание", href: "/teacher/schedule" },
    ],
  },
];

// Admins additionally reach the 152-ФЗ data-protection contour from here.
const ADMIN_DATA: NavGroup = {
  title: "Защита данных · 152-ФЗ",
  accent: true,
  links: [
    { label: "Импорт данных", href: "/admin/data/import" },
    { label: "Анонимизация", href: "/admin/data/anonymize" },
    { label: "Приватность данных", href: "/admin/data/privacy" },
  ],
};

interface StaffShellProps {
  eyebrow?: string;
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export function StaffShell({ eyebrow, title, actions, children }: StaffShellProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const admin = isAdmin(user);
  const groups = admin ? [...TEACHING, ADMIN_DATA] : TEACHING;
  const roleLabel = admin ? "Администратор" : "Преподаватель";

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  return (
    <div className="layout-container">
      <aside className="sidebar">
        <div className="logo-container">
          <div className="logo-circle">С</div>
          <div>
            <div className="logo-text">Сириус 27</div>
            <div className="logo-subtext">образовательная платформа</div>
          </div>
        </div>

        <nav className="nav-menu">
          {groups.map((group) => (
            <React.Fragment key={group.title}>
              <div
                className="nav-section-title"
                style={group.accent ? { color: "var(--color-brand-teal)" } : undefined}
              >
                {group.title}
              </div>
              {group.links.map((link) => {
                const active =
                  link.href === "/teacher"
                    ? pathname === "/teacher"
                    : pathname.startsWith(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`nav-item${active ? " active" : ""}`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </React.Fragment>
          ))}
        </nav>
      </aside>

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
              {eyebrow ?? "Контур преподавателя"}
            </span>
            <h2 style={{ fontSize: "1.5rem", fontWeight: 800 }}>{title}</h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            {actions}
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{roleLabel}</div>
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
              {(user?.email?.[0] ?? "П").toUpperCase()}
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

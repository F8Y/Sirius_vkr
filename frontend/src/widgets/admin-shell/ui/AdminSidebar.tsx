"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavLink {
  label: string;
  href?: string; // absent → not yet implemented (Batch 5), shown muted
  soon?: boolean;
}

interface NavGroup {
  title: string;
  accent?: boolean; // the 152-ФЗ data-protection group is visually emphasised
  links: NavLink[];
}

// Grouped admin navigation per DESIGN_BRIEF §4. No emoji — calm working tool.
const GROUPS: NavGroup[] = [
  {
    title: "Обзор",
    links: [
      { label: "Дашборд", href: "/admin" },
      { label: "Аналитика", soon: true },
    ],
  },
  {
    title: "Обучение",
    links: [
      { label: "Успеваемость", soon: true },
      { label: "Мои курсы", soon: true },
      { label: "Группы", soon: true },
      { label: "Расписание", soon: true },
      { label: "Работы", soon: true },
    ],
  },
  {
    title: "Администрирование",
    links: [
      { label: "Пользователи и роли", soon: true },
      { label: "Импорт данных", href: "/admin/data/import" },
    ],
  },
  {
    title: "Защита данных · 152-ФЗ",
    accent: true,
    links: [
      { label: "Анонимизация", href: "/admin/data/anonymize" },
      { label: "Приватность данных", href: "/admin/data/privacy" },
    ],
  },
];

export function AdminSidebar() {
  const pathname = usePathname() ?? "";

  return (
    <aside className="sidebar">
      <div className="logo-container">
        <div className="logo-circle">С</div>
        <div>
          <div className="logo-text">Сириус 27</div>
          <div className="logo-subtext">образовательная платформа</div>
        </div>
      </div>

      <nav className="nav-menu">
        {GROUPS.map((group) => (
          <React.Fragment key={group.title}>
            <div
              className="nav-section-title"
              style={group.accent ? { color: "var(--color-brand-teal)" } : undefined}
            >
              {group.title}
            </div>
            {group.links.map((link) => {
              if (!link.href) {
                return (
                  <div
                    key={link.label}
                    className="nav-item"
                    style={{ cursor: "default", opacity: 0.55 }}
                  >
                    <span>{link.label}</span>
                    {link.soon && <span className="nav-soon">скоро</span>}
                  </div>
                );
              }
              const active =
                link.href === "/admin" ? pathname === "/admin" : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.label}
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
  );
}

"use client";

import React from "react";
import Link from "next/link";
import { AdminShell } from "@/widgets/admin-shell";
import { SystemHealth } from "@/widgets/system-health/ui/SystemHealth";

const TOOLS = [
  {
    href: "/admin/data/import",
    title: "Импорт данных",
    desc: "Загрузка датасета (CSV/Excel), создание задачи и контроль построчной валидации.",
  },
  {
    href: "/admin/data/anonymize",
    title: "Обезличивание",
    desc: "Псевдонимизация и анонимизация наборов, расчёт k-анонимности.",
  },
  {
    href: "/admin/data/privacy",
    title: "Приватность данных",
    desc: "Реестр согласий и запросы субъектов по ст. 14 / 20 152-ФЗ.",
  },
];

export function AdminDashboardPage() {
  return (
    <AdminShell eyebrow="Контур администратора безопасности" title="Дашборд">
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "24px" }}>
        <div className="panel">
          <div>
            <div className="panel-title">Инструменты защиты данных</div>
            <div className="panel-subtitle">Ключевые операции контура 152-ФЗ</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {TOOLS.map((tool) => (
              <Link
                key={tool.href}
                href={tool.href}
                className="field-row"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div>
                  <div className="field-name">{tool.title}</div>
                  <div className="panel-subtitle">{tool.desc}</div>
                </div>
                <span style={{ color: "var(--color-primary-blue)", fontWeight: 700 }}>→</span>
              </Link>
            ))}
          </div>
        </div>

        <SystemHealth />
      </div>
    </AdminShell>
  );
}

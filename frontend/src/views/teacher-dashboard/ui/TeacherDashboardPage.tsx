"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ApiError } from "@/shared/api";
import { KpiPlate } from "@/shared/ui";
import { StaffShell } from "@/widgets/staff-shell";
import { fetchAnalyticsSummary, type AnalyticsSummary } from "@/entities/analytics";

const SECTIONS = [
  {
    href: "/teacher/students",
    title: "Успеваемость",
    desc: "Реестр обучающихся с прогрессом и статусом.",
  },
  {
    href: "/teacher/courses",
    title: "Мои курсы",
    desc: "Создание, публикация и структура курсов.",
  },
  { href: "/teacher/groups", title: "Группы", desc: "Состав групп и перенос обучающихся." },
  {
    href: "/teacher/schedule",
    title: "Расписание",
    desc: "Недельная сетка занятий по направлениям.",
  },
  {
    href: "/teacher/analytics",
    title: "Аналитика",
    desc: "Активность, завершаемость, направления.",
  },
];

export function TeacherDashboardPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAnalyticsSummary()
      .then((s) => {
        if (!cancelled) setSummary(s);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : "Не удалось загрузить данные");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <StaffShell title="Дашборд">
      {error && <div className="panel">{error}</div>}
      <div className="kpi-grid">
        <KpiPlate label="Обучающихся" value={summary?.total_students ?? "—"} />
        <KpiPlate label="Активных" value={summary?.active_students ?? "—"} accent="blue" />
        <KpiPlate label="Курсов" value={summary?.total_courses ?? "—"} />
        <KpiPlate
          label="Завершаемость"
          value={summary ? `${Math.round(summary.completion_rate * 100)}%` : "—"}
          accent="green"
        />
      </div>

      <section className="panel">
        <div className="panel-title">Разделы</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {SECTIONS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="field-row"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div>
                <div className="field-name">{s.title}</div>
                <div className="panel-subtitle">{s.desc}</div>
              </div>
              <span style={{ color: "var(--color-primary-blue)", fontWeight: 700 }}>→</span>
            </Link>
          ))}
        </div>
      </section>
    </StaffShell>
  );
}

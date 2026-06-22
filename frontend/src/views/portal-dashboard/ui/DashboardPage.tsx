"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ApiError } from "@/shared/api";
import { DirectionTag, ProgressBar } from "@/shared/ui";
import { fetchDashboard, type DashboardResponse } from "@/entities/me";
import { usePortalChild } from "@/widgets/portal-shell";

function firstName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts[1] ?? parts[0] ?? "";
}

export function DashboardPage() {
  const { childId, isParentView } = usePortalChild();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchDashboard(childId)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : "Не удалось загрузить данные");
      });
    return () => {
      cancelled = true;
    };
  }, [childId]);

  if (error) return <div className="panel">{error}</div>;
  if (!data) return <div className="panel muted">Загрузка…</div>;

  const active = data.courses.filter((c) => c.status === "active");
  const completed = data.courses.filter((c) => c.status === "completed");

  return (
    <>
      <section className="portal-hero portal-hero--vivid">
        <div>
          <div className="portal-hero-title">
            {isParentView
              ? `Кабинет родителя · ${data.student_name}`
              : `Привет, ${firstName(data.student_name)}!`}
          </div>
          <div className="portal-hero-sub">
            {isParentView
              ? "Наблюдение за обучением ребёнка. Просмотр без редактирования."
              : "Продолжай учиться — твой прогресс ждёт тебя."}
          </div>
        </div>
        <div className="portal-hero-stats">
          <div className="portal-stat-card">
            <div className="portal-stat-value">{data.xp}</div>
            <div className="portal-stat-label">XP</div>
          </div>
          <div className="portal-stat-card">
            <div className="portal-stat-value">{data.level}</div>
            <div className="portal-stat-label">Уровень</div>
          </div>
          <div className="portal-stat-card">
            <div className="portal-stat-value">{data.streak_days}</div>
            <div className="portal-stat-label">Серия, дней</div>
          </div>
        </div>
      </section>

      <section className="panel">
        <div>
          <div className="panel-title">Продолжить обучение</div>
          <div className="panel-subtitle">
            Активных курсов: {data.active_courses} · завершено: {data.completed_courses}
          </div>
        </div>
        {active.length === 0 ? (
          <div className="muted">
            Нет активных курсов.{" "}
            <Link href="/courses" style={{ color: "var(--color-primary-blue)" }}>
              Перейти в каталог
            </Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {active.map((c) => (
              <Link key={c.course_id} href={`/courses/${c.course_id}`} className="learn-row">
                <div className="learn-row-main">
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span className="learn-row-title">{c.course_title}</span>
                    <DirectionTag direction={c.direction} />
                  </div>
                  <div className="learn-row-sub">{c.group_name}</div>
                  <ProgressBar value={c.progress} />
                </div>
                <div className="learn-row-pct">{c.progress}%</div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {completed.length > 0 && (
        <section className="panel">
          <div className="panel-title">Завершённые курсы</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {completed.map((c) => (
              <Link
                key={c.course_id}
                href={`/courses/${c.course_id}`}
                className="transfer-row"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <span style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  {c.course_title}
                  <DirectionTag direction={c.direction} />
                </span>
                <span style={{ fontWeight: 700, color: "var(--status-green-text)" }}>100%</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

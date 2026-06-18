"use client";

import React, { useEffect, useState } from "react";
import { ApiError } from "@/shared/api";
import { DirectionTag, KpiPlate } from "@/shared/ui";
import { directionColor } from "@/shared/lib/direction";
import { StaffShell } from "@/widgets/staff-shell";
import { fetchAnalyticsSummary, type AnalyticsSummary } from "@/entities/analytics";

export function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAnalyticsSummary()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled)
          setError(e instanceof ApiError ? e.message : "Не удалось загрузить аналитику");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const maxStudents = data ? Math.max(1, ...data.by_direction.map((d) => d.students)) : 1;

  return (
    <StaffShell title="Аналитика">
      {error && <div className="panel">{error}</div>}

      <div className="kpi-grid">
        <KpiPlate label="Всего обучающихся" value={data?.total_students ?? "—"} />
        <KpiPlate label="Активных" value={data?.active_students ?? "—"} accent="blue" />
        <KpiPlate
          label="Курсов"
          value={data?.total_courses ?? "—"}
          hint={data ? `опубликовано: ${data.published_courses}` : undefined}
        />
        <KpiPlate label="Записей на курсы" value={data?.total_enrollments ?? "—"} />
        <KpiPlate
          label="Завершаемость"
          value={data ? `${Math.round(data.completion_rate * 100)}%` : "—"}
          accent="green"
        />
      </div>

      <section className="panel">
        <div className="panel-title">По направлениям</div>
        {!data ? (
          <div className="muted">Загрузка…</div>
        ) : data.by_direction.length === 0 ? (
          <div className="muted">Нет данных.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {data.by_direction.map((d) => (
              <div
                key={d.direction}
                style={{ display: "flex", flexDirection: "column", gap: "6px" }}
              >
                <div
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                >
                  <DirectionTag direction={d.direction} />
                  <span className="muted" style={{ fontSize: "0.82rem" }}>
                    {d.students} учеников · {d.courses} курсов · завершаемость{" "}
                    {Math.round(d.completion_rate * 100)}%
                  </span>
                </div>
                <div className="progress-container" style={{ height: "12px" }}>
                  <div
                    className="progress-bar"
                    style={{
                      width: `${Math.round((d.students / maxStudents) * 100)}%`,
                      backgroundColor: directionColor(d.direction),
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </StaffShell>
  );
}

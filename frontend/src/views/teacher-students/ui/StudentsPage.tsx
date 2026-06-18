"use client";

import React, { useEffect, useState } from "react";
import { ApiError } from "@/shared/api";
import { DirectionTag, ProgressBar, StatusChip, type ChipTone } from "@/shared/ui";
import { StaffShell } from "@/widgets/staff-shell";
import { fetchStudents, type RegistryStatus, type StudentRegistryItem } from "@/entities/student";

const STATUS: Record<RegistryStatus, { label: string; tone: ChipTone }> = {
  active: { label: "Учится", tone: "blue" },
  completed: { label: "Завершил", tone: "green" },
  none: { label: "Без курсов", tone: "neutral" },
};

export function StudentsPage() {
  const [rows, setRows] = useState<StudentRegistryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchStudents()
      .then((s) => {
        if (!cancelled) setRows(s);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : "Не удалось загрузить реестр");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <StaffShell title="Успеваемость" eyebrow="Реестр обучающихся">
      {error && <div className="panel">{error}</div>}
      <section className="panel">
        <div className="panel-subtitle">
          Имена восстановлены из зашифрованных данных через vault.decrypt_pii. Всего: {rows.length}
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Обучающийся</th>
              <th>Направления</th>
              <th>Курсов</th>
              <th style={{ width: "200px" }}>Прогресс</th>
              <th>Статус</th>
              <th>Уровень</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="muted">
                  Загрузка…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted">
                  Данных нет.
                </td>
              </tr>
            ) : (
              rows.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>{s.student_name}</td>
                  <td>
                    <span style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                      {s.directions.length === 0 ? (
                        <span className="muted">—</span>
                      ) : (
                        s.directions.map((d) => <DirectionTag key={d} direction={d} />)
                      )}
                    </span>
                  </td>
                  <td>{s.courses_count}</td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{ flex: 1 }}>
                        <ProgressBar value={s.avg_progress} />
                      </div>
                      <span style={{ fontWeight: 700, minWidth: "38px" }}>{s.avg_progress}%</span>
                    </div>
                  </td>
                  <td>
                    <StatusChip label={STATUS[s.status].label} tone={STATUS[s.status].tone} />
                  </td>
                  <td>
                    {s.level} · {s.xp} XP
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </StaffShell>
  );
}

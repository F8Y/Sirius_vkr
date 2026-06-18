"use client";

import React, { useEffect, useState } from "react";
import { ApiError } from "@/shared/api";
import { StaffShell } from "@/widgets/staff-shell";
import { WeekGrid, fetchSchedule, type ScheduleItem } from "@/entities/schedule";

export function TeacherSchedulePage() {
  const [items, setItems] = useState<ScheduleItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchSchedule()
      .then((s) => {
        if (!cancelled) setItems(s);
      })
      .catch((e) => {
        if (!cancelled)
          setError(e instanceof ApiError ? e.message : "Не удалось загрузить расписание");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <StaffShell title="Расписание">
      {error ? (
        <div className="panel">{error}</div>
      ) : !items ? (
        <div className="panel muted">Загрузка…</div>
      ) : items.length === 0 ? (
        <div className="panel muted">Занятий пока нет.</div>
      ) : (
        <section className="panel">
          <WeekGrid items={items} />
        </section>
      )}
    </StaffShell>
  );
}

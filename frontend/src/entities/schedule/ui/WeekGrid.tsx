import React from "react";
import { directionColor } from "@/shared/lib/direction";
import type { ScheduleItem } from "../model/types";

const DAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function hhmm(t: string): string {
  return t.slice(0, 5);
}

/**
 * Weekly timetable grid. Each slot is tinted by its course direction (the only
 * place direction colour appears). Shared by the student and staff schedules.
 */
export function WeekGrid({ items }: { items: ScheduleItem[] }) {
  const byDay: ScheduleItem[][] = DAYS.map((_, i) =>
    items.filter((s) => s.weekday === i).sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  );

  return (
    <div className="week-grid">
      {DAYS.map((day, i) => (
        <div key={day} className="week-col">
          <div className="week-col-head">{day}</div>
          {byDay[i].length === 0 ? (
            <div className="week-empty">—</div>
          ) : (
            byDay[i].map((s) => (
              <div
                key={s.id}
                className="slot"
                style={{ "--slot-accent": directionColor(s.direction) } as React.CSSProperties}
              >
                <div className="slot-time">
                  {hhmm(s.starts_at)}–{hhmm(s.ends_at)}
                </div>
                <div className="slot-title">{s.course_title}</div>
                <div className="slot-room">
                  {s.group_name}
                  {s.room ? ` · ${s.room}` : ""}
                </div>
              </div>
            ))
          )}
        </div>
      ))}
    </div>
  );
}

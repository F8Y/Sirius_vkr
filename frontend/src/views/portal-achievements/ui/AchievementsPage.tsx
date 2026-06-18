"use client";

import React, { useEffect, useState } from "react";
import { ApiError } from "@/shared/api";
import { fetchAchievements, type AchievementsResponse } from "@/entities/me";
import { usePortalChild } from "@/widgets/portal-shell";

// Level title by level band — a friendly "звание" for the student portal.
function rankTitle(level: number): string {
  if (level >= 7) return "Магистр знаний";
  if (level >= 5) return "Знаток";
  if (level >= 3) return "Исследователь";
  if (level >= 2) return "Ученик";
  return "Новичок";
}

export function AchievementsPage() {
  const { childId } = usePortalChild();
  const [data, setData] = useState<AchievementsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAchievements(childId)
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

  const pct =
    data.next_level_xp > 0 ? Math.min(100, Math.round((data.xp / data.next_level_xp) * 100)) : 0;
  const earned = data.badges.filter((b) => b.earned).length;

  return (
    <>
      <section className="panel">
        <div className="panel-title">Достижения</div>
        <div
          style={{
            display: "flex",
            gap: "var(--spacing-lg)",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div className="level-ring" style={{ "--ring": `${pct}%` } as React.CSSProperties}>
            <div className="level-ring-inner">
              <div style={{ fontSize: "1.8rem", fontWeight: 800 }}>{data.level}</div>
              <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>уровень</div>
            </div>
          </div>
          <div
            style={{
              flex: 1,
              minWidth: "220px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div style={{ fontSize: "1.2rem", fontWeight: 800 }}>{rankTitle(data.level)}</div>
            <div className="muted">
              {data.xp} / {data.next_level_xp} XP до следующего уровня
            </div>
            <div className="progress-container">
              <div className="progress-bar" style={{ width: `${pct}%` }} />
            </div>
            <div style={{ display: "flex", gap: "12px", marginTop: "6px" }}>
              <span className="portal-stat-pill">🔥 Серия: {data.streak_days} дн.</span>
              <span className="portal-stat-pill level">
                Бейджи: {earned} / {data.badges.length}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-title">Бейджи</div>
        <div className="badge-grid">
          {data.badges.map((b) => (
            <div key={b.code} className={`badge-tile${b.earned ? "" : " locked"}`}>
              <div className="badge-emblem">{b.title.slice(0, 1)}</div>
              <div className="badge-title">{b.title}</div>
              {b.description && <div className="badge-desc">{b.description}</div>}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

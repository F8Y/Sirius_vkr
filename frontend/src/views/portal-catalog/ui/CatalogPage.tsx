"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ApiError } from "@/shared/api";
import { CourseCard, fetchCourses, type CourseSummary } from "@/entities/course";

const DIRECTIONS = ["Наука", "Искусство", "Спорт"];

export function CatalogPage() {
  const [all, setAll] = useState<CourseSummary[]>([]);
  const [dir, setDir] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCourses()
      .then((list) => {
        if (!cancelled) setAll(list);
      })
      .catch((e) => {
        if (!cancelled)
          setError(e instanceof ApiError ? e.message : "Не удалось загрузить каталог");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // The student catalogue shows only published courses; drafts stay in the
  // staff "Мои курсы" view until published.
  const courses = useMemo(() => {
    const published = all.filter((c) => c.status === "published");
    return dir ? published.filter((c) => c.direction === dir) : published;
  }, [all, dir]);

  return (
    <>
      <section style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <h2 style={{ fontSize: "1.6rem", fontWeight: 800 }}>Каталог курсов</h2>
        <div className="segmented">
          <button className={dir === null ? "active" : ""} onClick={() => setDir(null)}>
            Все
          </button>
          {DIRECTIONS.map((d) => (
            <button key={d} className={dir === d ? "active" : ""} onClick={() => setDir(d)}>
              {d}
            </button>
          ))}
        </div>
      </section>

      {error ? (
        <div className="panel">{error}</div>
      ) : courses.length === 0 ? (
        <div className="panel muted">Курсы не найдены.</div>
      ) : (
        <div className="portal-cards">
          {courses.map((c) => (
            <CourseCard key={c.id} course={c} href={`/courses/${c.id}`} />
          ))}
        </div>
      )}
    </>
  );
}

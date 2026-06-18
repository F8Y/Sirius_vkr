"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ApiError } from "@/shared/api";
import { DirectionTag, StatusChip, type ChipTone } from "@/shared/ui";
import { StaffShell } from "@/widgets/staff-shell";
import {
  fetchCourse,
  publishCourse,
  type CourseDetail,
  type CourseStatus,
} from "@/entities/course";

const STATUS: Record<CourseStatus, { label: string; tone: ChipTone }> = {
  draft: { label: "Черновик", tone: "yellow" },
  published: { label: "Опубликован", tone: "green" },
  archived: { label: "Архив", tone: "neutral" },
};

export function CourseEditorPage({ courseId }: { courseId: string }) {
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setCourse(await fetchCourse(courseId));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Курс не найден");
    }
  }, [courseId]);

  // Inline initial load (see CoursesPage); ``load`` is reused after publish.
  useEffect(() => {
    let cancelled = false;
    fetchCourse(courseId)
      .then((c) => {
        if (!cancelled) setCourse(c);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : "Курс не найден");
      });
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  const handlePublish = async () => {
    try {
      await publishCourse(courseId);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось опубликовать");
    }
  };

  return (
    <StaffShell
      title={course?.title ?? "Курс"}
      eyebrow="Редактор курса"
      actions={
        course?.status === "draft" ? (
          <button className="btn btn-primary" style={{ width: "auto" }} onClick={handlePublish}>
            Опубликовать
          </button>
        ) : undefined
      }
    >
      {error && <div className="panel">{error}</div>}
      {!course ? (
        <div className="panel muted">Загрузка…</div>
      ) : (
        <>
          <Link href="/teacher/courses" className="muted" style={{ textDecoration: "none" }}>
            ← Мои курсы
          </Link>

          <section className="panel">
            <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
              <DirectionTag direction={course.direction} />
              <StatusChip label={STATUS[course.status].label} tone={STATUS[course.status].tone} />
              <span className="muted">
                {course.modules.length} модулей · {course.lessons_count} уроков ·{" "}
                {course.groups.length} групп
              </span>
            </div>
            {course.description && <p className="muted">{course.description}</p>}
          </section>

          <section className="panel">
            <div>
              <div className="panel-title">Программа</div>
              <div className="panel-subtitle">Модули, уроки и материалы курса</div>
            </div>
            {course.modules.length === 0 ? (
              <div className="muted">В курсе ещё нет модулей.</div>
            ) : (
              course.modules.map((m, idx) => (
                <div key={m.id} style={{ marginTop: "8px" }}>
                  <div style={{ fontWeight: 700, marginBottom: "8px" }}>
                    Модуль {idx + 1}. {m.title}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {m.lessons.map((l) => (
                      <div key={l.id} className="transfer-row">
                        <span>{l.title}</span>
                        {l.material_url ? (
                          <StatusChip label="Материал" tone="blue" />
                        ) : (
                          <span className="muted" style={{ fontSize: "0.78rem" }}>
                            без материала
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </section>

          {course.groups.length > 0 && (
            <section className="panel">
              <div className="panel-title">Группы курса</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {course.groups.map((g) => (
                  <span key={g.id} className="portal-stat-pill">
                    {g.name}
                  </span>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </StaffShell>
  );
}

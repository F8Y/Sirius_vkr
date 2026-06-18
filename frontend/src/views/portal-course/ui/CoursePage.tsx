"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ApiError } from "@/shared/api";
import { DirectionTag } from "@/shared/ui";
import { directionColor } from "@/shared/lib/direction";
import { enroll, fetchCourse, type CourseDetail } from "@/entities/course";
import { usePortalChild } from "@/widgets/portal-shell";

type EnrollState =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "done"; message: string }
  | { kind: "already" }
  | { kind: "error"; message: string };

export function CoursePage({ courseId }: { courseId: string }) {
  const { isParentView } = usePortalChild();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string>("");
  const [enrollState, setEnrollState] = useState<EnrollState>({ kind: "idle" });

  useEffect(() => {
    let cancelled = false;
    fetchCourse(courseId)
      .then((c) => {
        if (cancelled) return;
        setCourse(c);
        setGroupId((prev) => prev || c.groups[0]?.id || "");
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : "Курс не найден");
      });
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  const handleEnroll = useCallback(async () => {
    if (!groupId) return;
    setEnrollState({ kind: "busy" });
    try {
      await enroll(groupId);
      setEnrollState({ kind: "done", message: "Вы записаны на курс!" });
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setEnrollState({ kind: "already" });
      } else {
        setEnrollState({
          kind: "error",
          message: e instanceof ApiError ? e.message : "Не удалось записаться",
        });
      }
    }
  }, [groupId]);

  if (error) return <div className="panel">{error}</div>;
  if (!course) return <div className="panel muted">Загрузка…</div>;

  const color = directionColor(course.direction);
  const canEnroll = !isParentView && course.groups.length > 0;

  return (
    <>
      <Link href="/courses" className="muted" style={{ textDecoration: "none" }}>
        ← Каталог
      </Link>

      <section
        className="portal-hero"
        style={{ background: `linear-gradient(135deg, ${color}26 0%, ${color}10 100%)` }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <DirectionTag direction={course.direction} />
          <div className="portal-hero-title">{course.title}</div>
          {course.description && <div className="portal-hero-sub">{course.description}</div>}
          <div className="muted" style={{ fontSize: "0.85rem" }}>
            {course.modules.length} модулей · {course.lessons_count} уроков
          </div>
        </div>

        {canEnroll && (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", minWidth: "220px" }}>
            {course.groups.length > 1 && (
              <select
                className="form-control"
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
              >
                {course.groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            )}
            <button
              className="btn btn-primary"
              onClick={handleEnroll}
              disabled={enrollState.kind === "busy"}
            >
              {enrollState.kind === "busy" ? "Запись…" : "Записаться на курс"}
            </button>
            {enrollState.kind === "done" && (
              <span style={{ color: "var(--status-green-text)", fontSize: "0.85rem" }}>
                {enrollState.message}
              </span>
            )}
            {enrollState.kind === "already" && (
              <span style={{ color: "var(--status-blue-text)", fontSize: "0.85rem" }}>
                Вы уже записаны на этот курс.
              </span>
            )}
            {enrollState.kind === "error" && (
              <span style={{ color: "var(--status-red-text)", fontSize: "0.85rem" }}>
                {enrollState.message}
              </span>
            )}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-title">Программа курса</div>
        {course.modules.length === 0 ? (
          <div className="muted">Программа курса появится позже.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {course.modules.map((m, idx) => (
              <div key={m.id}>
                <div style={{ fontWeight: 700, marginBottom: "8px" }}>
                  Модуль {idx + 1}. {m.title}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {m.lessons.map((l) => (
                    <div key={l.id} className="transfer-row">
                      <div>
                        <div style={{ fontWeight: 600 }}>{l.title}</div>
                        {l.content && (
                          <div className="muted" style={{ fontSize: "0.8rem" }}>
                            {l.content}
                          </div>
                        )}
                      </div>
                      {l.material_url && (
                        <a
                          href={l.material_url}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            color: "var(--color-primary-blue)",
                            fontWeight: 600,
                            fontSize: "0.82rem",
                          }}
                        >
                          Материал
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ApiError } from "@/shared/api";
import { DirectionTag, StatusChip, type ChipTone } from "@/shared/ui";
import { StaffShell } from "@/widgets/staff-shell";
import {
  createCourse,
  fetchCourses,
  publishCourse,
  type CourseStatus,
  type CourseSummary,
} from "@/entities/course";

const STATUS: Record<CourseStatus, { label: string; tone: ChipTone }> = {
  draft: { label: "Черновик", tone: "yellow" },
  published: { label: "Опубликован", tone: "green" },
  archived: { label: "Архив", tone: "neutral" },
};

const DIRECTIONS = ["Наука", "Искусство", "Спорт"];

export function CoursesPage() {
  const [rows, setRows] = useState<CourseSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [direction, setDirection] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setRows(await fetchCourses());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось загрузить курсы");
    }
  }, []);

  // Inline initial load — calling a setState-bearing callback from an effect is
  // flagged by react-hooks/set-state-in-effect; ``refresh`` is for handlers only.
  useEffect(() => {
    let cancelled = false;
    fetchCourses()
      .then((list) => {
        if (!cancelled) setRows(list);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : "Не удалось загрузить курсы");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await createCourse({
        title: title.trim(),
        direction: direction || null,
        description: description.trim() || null,
      });
      setTitle("");
      setDirection("");
      setDescription("");
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось создать курс");
    } finally {
      setBusy(false);
    }
  };

  const handlePublish = async (id: string) => {
    try {
      await publishCourse(id);
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось опубликовать курс");
    }
  };

  return (
    <StaffShell title="Мои курсы">
      {error && <div className="panel">{error}</div>}

      <section className="panel">
        <div className="panel-title">Новый курс</div>
        <form
          onSubmit={handleCreate}
          style={{ display: "flex", flexDirection: "column", gap: "12px" }}
        >
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <input
              className="form-control"
              style={{ flex: 2, minWidth: "220px" }}
              placeholder="Название курса"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={busy}
            />
            <select
              className="form-control"
              style={{ flex: 1, minWidth: "160px" }}
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
              disabled={busy}
            >
              <option value="">Без направления</option>
              {DIRECTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <input
            className="form-control"
            placeholder="Краткое описание"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={busy}
          />
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "auto", alignSelf: "flex-start" }}
            disabled={busy || !title.trim()}
          >
            {busy ? "Создание…" : "Создать черновик"}
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="panel-title">Все курсы</div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Курс</th>
              <th>Направление</th>
              <th>Уроки</th>
              <th>Группы</th>
              <th>Статус</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted">
                  Курсов пока нет.
                </td>
              </tr>
            ) : (
              rows.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>
                    <Link
                      href={`/teacher/courses/${c.id}`}
                      style={{ color: "inherit", textDecoration: "none" }}
                    >
                      {c.title}
                    </Link>
                  </td>
                  <td>
                    <DirectionTag direction={c.direction} />
                  </td>
                  <td>{c.lessons_count}</td>
                  <td>{c.groups_count}</td>
                  <td>
                    <StatusChip label={STATUS[c.status].label} tone={STATUS[c.status].tone} />
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {c.status === "draft" && (
                      <button
                        className="btn btn-primary"
                        style={{ width: "auto", padding: "6px 14px" }}
                        onClick={() => handlePublish(c.id)}
                      >
                        Опубликовать
                      </button>
                    )}
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

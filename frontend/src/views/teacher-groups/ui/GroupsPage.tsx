"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ApiError } from "@/shared/api";
import { DirectionTag } from "@/shared/ui";
import { StaffShell } from "@/widgets/staff-shell";
import {
  fetchGroup,
  fetchGroups,
  updateGroupMembers,
  type GroupDetail,
  type GroupMember,
  type GroupSummary,
} from "@/entities/group";

export function GroupsPage() {
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [courseId, setCourseId] = useState<string>("");
  const [targetId, setTargetId] = useState<string>("");
  const [target, setTarget] = useState<GroupDetail | null>(null);
  const [siblings, setSiblings] = useState<GroupMember[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Courses derived from the group list (group carries course_id/title/direction).
  const courses = useMemo(() => {
    const map = new Map<string, { id: string; title: string; direction: string | null }>();
    for (const g of groups) {
      if (!map.has(g.course_id))
        map.set(g.course_id, { id: g.course_id, title: g.course_title, direction: g.direction });
    }
    return [...map.values()];
  }, [groups]);

  // Effective selections derived during render (avoids default-setting effects).
  const activeCourseId = courseId || courses[0]?.id || "";
  const courseGroups = useMemo(
    () => groups.filter((g) => g.course_id === activeCourseId),
    [groups, activeCourseId]
  );
  const activeTargetId =
    targetId && courseGroups.some((g) => g.id === targetId) ? targetId : courseGroups[0]?.id || "";

  useEffect(() => {
    let cancelled = false;
    fetchGroups()
      .then((g) => {
        if (!cancelled) setGroups(g);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : "Не удалось загрузить группы");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Load the target group's members and the pool of transferable students from
  // sibling groups. Re-runs whenever the target or the group list changes
  // (a transfer refreshes ``groups``, which re-triggers this).
  useEffect(() => {
    if (!activeTargetId) return;
    let cancelled = false;
    fetchGroup(activeTargetId)
      .then((detail) => {
        const others = groups.filter(
          (g) => g.course_id === detail.course_id && g.id !== activeTargetId
        );
        Promise.all(others.map((g) => fetchGroup(g.id))).then((details) => {
          if (cancelled) return;
          setTarget(detail);
          setSiblings(details.flatMap((d) => d.members));
          setSelected(new Set());
        });
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : "Не удалось загрузить состав");
      });
    return () => {
      cancelled = true;
    };
  }, [activeTargetId, groups]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleTransfer = async () => {
    if (selected.size === 0 || !activeTargetId) return;
    setBusy(true);
    setError(null);
    try {
      await updateGroupMembers(activeTargetId, [...selected]);
      const fresh = await fetchGroups();
      setGroups(fresh); // re-triggers the load effect above
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось перенести");
    } finally {
      setBusy(false);
    }
  };

  const activeCourse = courses.find((c) => c.id === activeCourseId);

  return (
    <StaffShell title="Группы" eyebrow="Состав и перенос обучающихся">
      {error && <div className="panel">{error}</div>}

      <section className="panel">
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
          <label className="muted" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            Курс
            <select
              className="form-control"
              value={activeCourseId}
              onChange={(e) => {
                setCourseId(e.target.value);
                setTargetId("");
              }}
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </label>
          <label className="muted" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            Целевая группа
            <select
              className="form-control"
              value={activeTargetId}
              onChange={(e) => setTargetId(e.target.value)}
            >
              {courseGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          {activeCourse?.direction && <DirectionTag direction={activeCourse.direction} />}
        </div>

        <div className="transfer-grid">
          <div className="transfer-col">
            <div style={{ fontWeight: 700 }}>В группе «{target?.name ?? "—"}»</div>
            {target && target.members.length === 0 ? (
              <div className="muted">Пусто</div>
            ) : (
              target?.members.map((m) => (
                <div key={m.enrollment_id} className="transfer-row">
                  <span>{m.student_name}</span>
                  <span className="muted">{m.progress}%</span>
                </div>
              ))
            )}
          </div>

          <div className="transfer-actions">
            <button
              className="btn btn-primary"
              style={{ width: "auto" }}
              onClick={handleTransfer}
              disabled={busy || selected.size === 0}
            >
              ← Перенести ({selected.size})
            </button>
            <span className="muted" style={{ fontSize: "0.75rem", textAlign: "center" }}>
              Выберите обучающихся справа и перенесите в целевую группу
            </span>
          </div>

          <div className="transfer-col">
            <div style={{ fontWeight: 700 }}>Другие группы курса</div>
            {siblings.length === 0 ? (
              <div className="muted">Нет других обучающихся на курсе</div>
            ) : (
              siblings.map((m) => (
                <label key={m.enrollment_id} className="transfer-row" style={{ cursor: "pointer" }}>
                  <span style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={selected.has(m.student_id)}
                      onChange={() => toggle(m.student_id)}
                    />
                    {m.student_name}
                  </span>
                  <span className="muted">{m.progress}%</span>
                </label>
              ))
            )}
          </div>
        </div>
      </section>
    </StaffShell>
  );
}

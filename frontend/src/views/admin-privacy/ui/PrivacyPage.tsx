"use client";

import React, { useCallback, useEffect, useState } from "react";
import { AdminShell } from "@/widgets/admin-shell";
import { ApiError } from "@/shared/api";
import { KpiPlate, StatusChip, type ChipTone } from "@/shared/ui";
import {
  createRequest,
  fetchConsentKpi,
  fetchConsents,
  fetchRequests,
  fetchSubjectCard,
  fetchSubjects,
  syncConsents,
  updateRequest,
  type ConsentItem,
  type ConsentKpi,
  type RequestStatus,
  type RequestType,
  type SubjectCard,
  type SubjectRequestItem,
  type SubjectSummary,
} from "@/entities/privacy";

const REQUEST_STATUS: Record<RequestStatus, { label: string; tone: ChipTone }> = {
  new: { label: "Новый", tone: "yellow" },
  in_progress: { label: "В работе", tone: "blue" },
  done: { label: "Исполнен", tone: "green" },
  rejected: { label: "Отклонён", tone: "red" },
};

const REQUEST_TYPE: Record<RequestType, string> = {
  export: "Экспорт · ст. 14",
  delete: "Удаление · ст. 20",
};

const NEXT_STATUS: Partial<Record<RequestStatus, RequestStatus>> = {
  new: "in_progress",
  in_progress: "done",
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("ru-RU");
  } catch {
    return iso;
  }
}

export function PrivacyPage() {
  const [kpi, setKpi] = useState<ConsentKpi | null>(null);
  const [consents, setConsents] = useState<ConsentItem[]>([]);
  const [requests, setRequests] = useState<SubjectRequestItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectSummary[]>([]);
  const [card, setCard] = useState<SubjectCard | null>(null);
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [k, c, r, s] = await Promise.all([
        fetchConsentKpi(),
        fetchConsents(),
        fetchRequests(),
        fetchSubjects(),
      ]);
      setKpi(k);
      setConsents(c);
      setRequests(r);
      setSubjects(s);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось загрузить данные приватности");
    }
  }, []);

  // Initial load — setState only in the promise callback (post-commit).
  useEffect(() => {
    let active = true;
    Promise.all([fetchConsentKpi(), fetchConsents(), fetchRequests(), fetchSubjects()])
      .then(([k, c, r, s]) => {
        if (!active) return;
        setKpi(k);
        setConsents(c);
        setRequests(r);
        setSubjects(s);
        setError(null);
      })
      .catch((err) => {
        if (active) {
          setError(
            err instanceof ApiError ? err.message : "Не удалось загрузить данные приватности"
          );
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSync = async () => {
    setBusy(true);
    try {
      await syncConsents();
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось сформировать реестр");
    } finally {
      setBusy(false);
    }
  };

  const openCard = useCallback(async (subjectType: string, subjectId: string) => {
    setSelectedKey(`${subjectType}:${subjectId}`);
    try {
      const c = await fetchSubjectCard(subjectType as SubjectSummary["subject_type"], subjectId);
      setCard(c);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось открыть карточку субъекта");
    }
  }, []);

  const handleSelectChange = (value: string) => {
    if (!value) {
      setSelectedKey("");
      setCard(null);
      return;
    }
    const [type, id] = value.split(":");
    openCard(type, id);
  };

  const handleRight = async (type: RequestType) => {
    if (!card) return;
    setBusy(true);
    try {
      await createRequest({
        subject_type: card.subject.subject_type,
        subject_id: card.subject.subject_id,
        request_type: type,
      });
      await Promise.all([refresh(), openCard(card.subject.subject_type, card.subject.subject_id)]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось создать запрос");
    } finally {
      setBusy(false);
    }
  };

  const advanceRequest = async (req: SubjectRequestItem) => {
    const next = NEXT_STATUS[req.status];
    if (!next) return;
    setBusy(true);
    try {
      await updateRequest(req.id, next);
      await refresh();
      if (card && card.subject.subject_id === req.subject_id) {
        await openCard(card.subject.subject_type, card.subject.subject_id);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось обновить запрос");
    } finally {
      setBusy(false);
    }
  };

  const rejectRequest = async (req: SubjectRequestItem) => {
    setBusy(true);
    try {
      await updateRequest(req.id, "rejected");
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось обновить запрос");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminShell eyebrow="Защита данных · 152-ФЗ" title="Приватность данных">
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {error && (
          <div
            style={{
              fontSize: "0.85rem",
              color: "var(--status-red-text)",
              backgroundColor: "var(--status-red-bg)",
              padding: "10px",
              borderRadius: "8px",
            }}
          >
            {error}
          </div>
        )}

        {/* Consent KPI */}
        <div className="kpi-grid">
          <KpiPlate label="Субъектов ПДн" value={kpi?.subjects_total ?? "—"} />
          <KpiPlate label="Согласий учтено" value={kpi?.consents_total ?? "—"} accent="blue" />
          <KpiPlate label="Действующих" value={kpi?.granted ?? "—"} accent="green" />
          <KpiPlate
            label="Без согласия"
            value={kpi?.subjects_without_consent ?? "—"}
            accent={kpi && kpi.subjects_without_consent > 0 ? "red" : undefined}
          />
        </div>

        {kpi && kpi.consents_total === 0 && (
          <div className="panel">
            <div className="panel-title">Реестр согласий пуст</div>
            <div className="panel-subtitle">
              Сформируйте записи о согласии для импортированных субъектов, чтобы зафиксировать
              правовое основание обработки.
            </div>
            <button
              type="button"
              className="btn btn-primary"
              style={{ width: "auto", alignSelf: "flex-start" }}
              onClick={handleSync}
              disabled={busy}
            >
              {busy ? "Формирование…" : "Сформировать реестр согласий"}
            </button>
          </div>
        )}

        {/* Subject-rights requests */}
        <div className="panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div className="panel-title">Запросы субъектов</div>
              <div className="panel-subtitle">
                Реализация прав по ст. 14 (доступ/экспорт) и ст. 20 (удаление) 152-ФЗ. Срок ответа —
                10 дней.
              </div>
            </div>
            <button
              type="button"
              className="btn"
              style={{
                width: "auto",
                backgroundColor: "transparent",
                border: "1px solid var(--border-color)",
                color: "var(--text-secondary)",
              }}
              onClick={handleSync}
              disabled={busy}
            >
              Синхронизировать согласия
            </button>
          </div>

          {requests.length === 0 ? (
            <div className="panel-subtitle">
              Запросов пока нет. Создайте запрос из карточки субъекта ниже.
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Субъект</th>
                  <th>Право</th>
                  <th>Подан</th>
                  <th>Срок</th>
                  <th>Статус</th>
                  <th>Действие</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => {
                  const st = REQUEST_STATUS[req.status];
                  return (
                    <tr key={req.id}>
                      <td>{req.subject_name}</td>
                      <td>{REQUEST_TYPE[req.request_type]}</td>
                      <td>{formatDate(req.created_at)}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          {formatDate(req.due_at)}
                          {req.overdue && <StatusChip label="Просрочено" tone="red" />}
                        </div>
                      </td>
                      <td>
                        <StatusChip label={st.label} tone={st.tone} />
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "8px" }}>
                          {NEXT_STATUS[req.status] && (
                            <button
                              type="button"
                              onClick={() => advanceRequest(req)}
                              disabled={busy}
                              style={smallBtn}
                            >
                              {req.status === "new" ? "В работу" : "Исполнить"}
                            </button>
                          )}
                          {(req.status === "new" || req.status === "in_progress") && (
                            <button
                              type="button"
                              onClick={() => rejectRequest(req)}
                              disabled={busy}
                              style={{ ...smallBtn, color: "var(--status-red-text)" }}
                            >
                              Отклонить
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Subject card */}
        <div className="panel">
          <div className="panel-title">Карточка субъекта</div>
          <div className="form-group" style={{ marginBottom: 0, maxWidth: "420px" }}>
            <label className="form-label" htmlFor="subject-select">
              Выберите субъекта ПДн
            </label>
            <select
              id="subject-select"
              className="form-control"
              value={selectedKey}
              onChange={(e) => handleSelectChange(e.target.value)}
            >
              <option value="">— не выбран —</option>
              {subjects.map((s) => (
                <option
                  key={`${s.subject_type}:${s.subject_id}`}
                  value={`${s.subject_type}:${s.subject_id}`}
                >
                  {s.subject_name} ({s.subject_type === "student" ? "обучающийся" : "представитель"}
                  )
                </option>
              ))}
            </select>
          </div>

          {card && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <div style={{ fontSize: "1.1rem", fontWeight: 800 }}>
                  {card.subject.subject_name}
                </div>
                <div className="panel-subtitle">
                  {card.subject.subject_type === "student"
                    ? "Обучающийся"
                    : "Законный представитель"}
                </div>
              </div>

              {/* Rights — art. 14 / 20 */}
              <div
                className="field-row"
                style={{ alignItems: "flex-start", flexDirection: "column", gap: "10px" }}
              >
                <div className="field-name">Права субъекта (152-ФЗ)</div>
                <div className="panel-subtitle">
                  Ст. 14 — право на доступ и получение своих данных. Ст. 20 — право требовать
                  удаления или прекращения обработки.
                </div>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ width: "auto" }}
                    onClick={() => handleRight("export")}
                    disabled={busy}
                  >
                    Запрос на экспорт (ст. 14)
                  </button>
                  <button
                    type="button"
                    className="btn"
                    style={{
                      width: "auto",
                      backgroundColor: "transparent",
                      border: "1px solid var(--status-red-text)",
                      color: "var(--status-red-text)",
                    }}
                    onClick={() => handleRight("delete")}
                    disabled={busy}
                  >
                    Запрос на удаление (ст. 20)
                  </button>
                </div>
              </div>

              {/* Consent registry */}
              <div>
                <div className="field-name" style={{ marginBottom: "8px" }}>
                  Реестр согласий
                </div>
                {card.consents.length === 0 ? (
                  <div className="panel-subtitle">Согласия не зарегистрированы.</div>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Цель обработки</th>
                        <th>Статус</th>
                        <th>Дата</th>
                      </tr>
                    </thead>
                    <tbody>
                      {card.consents.map((c) => (
                        <tr key={c.id}>
                          <td>{c.purpose}</td>
                          <td>
                            {c.revoked_at ? (
                              <StatusChip label="Отозвано" tone="red" />
                            ) : c.granted ? (
                              <StatusChip label="Действует" tone="green" />
                            ) : (
                              <StatusChip label="Не дано" tone="neutral" />
                            )}
                          </td>
                          <td>{c.granted_at ? formatDate(c.granted_at) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Subject's own requests */}
              {card.requests.length > 0 && (
                <div>
                  <div className="field-name" style={{ marginBottom: "8px" }}>
                    Запросы субъекта
                  </div>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Право</th>
                        <th>Подан</th>
                        <th>Срок</th>
                        <th>Статус</th>
                      </tr>
                    </thead>
                    <tbody>
                      {card.requests.map((r) => {
                        const st = REQUEST_STATUS[r.status];
                        return (
                          <tr key={r.id}>
                            <td>{REQUEST_TYPE[r.request_type]}</td>
                            <td>{formatDate(r.created_at)}</td>
                            <td>{formatDate(r.due_at)}</td>
                            <td>
                              <StatusChip label={st.label} tone={st.tone} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Full consent register */}
        {consents.length > 0 && (
          <div className="panel">
            <div className="panel-title">Реестр согласий ({consents.length})</div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Субъект</th>
                  <th>Тип</th>
                  <th>Цель</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {consents.map((c) => (
                  <tr
                    key={c.id}
                    style={{ cursor: "pointer" }}
                    onClick={() => openCard(c.subject_type, c.subject_id)}
                  >
                    <td>{c.subject_name}</td>
                    <td>{c.subject_type === "student" ? "Обучающийся" : "Представитель"}</td>
                    <td>{c.purpose}</td>
                    <td>
                      {c.revoked_at ? (
                        <StatusChip label="Отозвано" tone="red" />
                      ) : c.granted ? (
                        <StatusChip label="Действует" tone="green" />
                      ) : (
                        <StatusChip label="Не дано" tone="neutral" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminShell>
  );
}

const smallBtn: React.CSSProperties = {
  border: "1px solid var(--border-color)",
  background: "transparent",
  color: "var(--color-primary-blue)",
  padding: "4px 10px",
  borderRadius: "6px",
  fontSize: "0.78rem",
  fontWeight: 600,
  cursor: "pointer",
};

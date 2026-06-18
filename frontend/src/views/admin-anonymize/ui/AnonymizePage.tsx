"use client";

import React, { useState } from "react";
import { AdminShell } from "@/widgets/admin-shell";
import { ApiError } from "@/shared/api";
import { KpiPlate, StatusChip } from "@/shared/ui";
import {
  JobStatusBadge,
  createJob,
  useJobPolling,
  type AnonymizeMode,
  type AnonymizeResult,
  type Dataset,
} from "@/entities/job";

type FieldTag = "direct" | "quasi" | null;

interface FieldPlan {
  field: string;
  label: string;
  tag: FieldTag;
  method: string; // technique applied in this mode
}

// Mirrors the worker pipeline (Batch 3): what happens to each field per mode.
const FIELD_PLANS: Record<Dataset, Record<AnonymizeMode, FieldPlan[]>> = {
  students: {
    pseudonymize: [
      { field: "last_name", label: "Фамилия", tag: "direct", method: "Токенизация nm_" },
      { field: "first_name", label: "Имя", tag: "direct", method: "Токенизация nm_" },
      { field: "middle_name", label: "Отчество", tag: "direct", method: "Токенизация nm_" },
      { field: "email", label: "Email", tag: "direct", method: "Токенизация eml_" },
      { field: "phone", label: "Телефон", tag: "direct", method: "Токенизация phn_" },
      { field: "birth_date", label: "Дата рождения", tag: "quasi", method: "Сохраняется" },
    ],
    anonymize: [
      { field: "id", label: "Идентификатор", tag: "direct", method: "Удаление → суррогат" },
      { field: "last_name", label: "Фамилия", tag: "direct", method: "Удаление" },
      { field: "first_name", label: "Имя", tag: "direct", method: "Удаление" },
      { field: "middle_name", label: "Отчество", tag: "direct", method: "Удаление" },
      { field: "email", label: "Email", tag: "direct", method: "Маскирование" },
      { field: "phone", label: "Телефон", tag: "direct", method: "Маскирование" },
      {
        field: "birth_date",
        label: "Дата рождения",
        tag: "quasi",
        method: "Обобщение (5 лет)",
      },
    ],
  },
  guardians: {
    pseudonymize: [
      { field: "last_name", label: "Фамилия", tag: "direct", method: "Токенизация nm_" },
      { field: "first_name", label: "Имя", tag: "direct", method: "Токенизация nm_" },
      { field: "middle_name", label: "Отчество", tag: "direct", method: "Токенизация nm_" },
      { field: "email", label: "Email", tag: "direct", method: "Токенизация eml_" },
      { field: "phone", label: "Телефон", tag: "direct", method: "Токенизация phn_" },
      { field: "relation_type", label: "Степень родства", tag: "quasi", method: "Сохраняется" },
    ],
    anonymize: [
      { field: "id", label: "Идентификатор", tag: "direct", method: "Удаление → суррогат" },
      { field: "last_name", label: "Фамилия", tag: "direct", method: "Удаление" },
      { field: "first_name", label: "Имя", tag: "direct", method: "Удаление" },
      { field: "middle_name", label: "Отчество", tag: "direct", method: "Удаление" },
      { field: "email", label: "Email", tag: "direct", method: "Маскирование" },
      { field: "phone", label: "Телефон", tag: "direct", method: "Маскирование" },
      {
        field: "relation_type",
        label: "Степень родства",
        tag: "quasi",
        method: "Сохраняется (КИ)",
      },
    ],
  },
};

const MODE_NOTE: Record<AnonymizeMode, string> = {
  pseudonymize:
    "Обратимо. Прямые идентификаторы заменяются стабильными токенами, соответствия хранятся в vault — данные остаются персональными.",
  anonymize:
    "Необратимо. Прямые идентификаторы удаляются, контактные данные маскируются, квазиидентификаторы обобщаются. Обратного отображения не сохраняется.",
};

function tagChip(tag: FieldTag) {
  if (tag === "direct") return <span className="tag tag-direct">Прямой идентификатор</span>;
  if (tag === "quasi") return <span className="tag tag-quasi">Квазиидентификатор</span>;
  return null;
}

export function AnonymizePage() {
  const [dataset, setDataset] = useState<Dataset>("students");
  const [mode, setMode] = useState<AnonymizeMode>("pseudonymize");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { job, start, reset } = useJobPolling();

  const plan = FIELD_PLANS[dataset][mode];

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    reset();
    try {
      const created = await createJob("anonymize", { mode, dataset });
      start(created);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось запустить обезличивание");
    } finally {
      setRunning(false);
    }
  };

  const result = job?.status === "done" ? (job.result as AnonymizeResult | undefined) : undefined;
  const k = result?.k_anonymity;

  return (
    <AdminShell eyebrow="Защита данных · 152-ФЗ" title="Обезличивание">
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {/* Configuration */}
        <div className="panel">
          <div>
            <div className="panel-title">Параметры обезличивания</div>
            <div className="panel-subtitle">Выберите набор данных и режим обработки</div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "24px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <span className="form-label">Набор данных</span>
              <div className="segmented">
                <button
                  className={dataset === "students" ? "active" : ""}
                  onClick={() => setDataset("students")}
                  disabled={running}
                >
                  Обучающиеся
                </button>
                <button
                  className={dataset === "guardians" ? "active" : ""}
                  onClick={() => setDataset("guardians")}
                  disabled={running}
                >
                  Представители
                </button>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <span className="form-label">Режим</span>
              <div className="segmented">
                <button
                  className={mode === "pseudonymize" ? "active" : ""}
                  onClick={() => setMode("pseudonymize")}
                  disabled={running}
                >
                  Псевдонимизация · Обратимо
                </button>
                <button
                  className={mode === "anonymize" ? "active" : ""}
                  onClick={() => setMode("anonymize")}
                  disabled={running}
                >
                  Анонимизация · Необратимо
                </button>
              </div>
            </div>
          </div>

          <div className="panel-subtitle" style={{ maxWidth: "720px" }}>
            {MODE_NOTE[mode]}
          </div>

          <button
            type="button"
            className="btn btn-primary"
            style={{ width: "auto", alignSelf: "flex-start" }}
            onClick={handleRun}
            disabled={running}
          >
            {running ? "Запуск…" : "Запустить обезличивание"}
          </button>

          {error && (
            <div
              style={{
                fontSize: "0.82rem",
                color: "var(--status-red-text)",
                backgroundColor: "var(--status-red-bg)",
                padding: "10px",
                borderRadius: "8px",
              }}
            >
              {error}
            </div>
          )}
        </div>

        {/* Technique per field */}
        <div className="panel">
          <div className="panel-title">Техника по полям</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {plan.map((f) => (
              <div key={f.field} className="field-row">
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span className="field-name">{f.label}</span>
                  {tagChip(f.tag)}
                </div>
                <span className="tag tag-method">{f.method}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Job status */}
        {job && (
          <div className="panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div className="panel-title">Задача обезличивания</div>
              <JobStatusBadge status={job.status} />
            </div>
            <div className="progress-container">
              <div className="progress-bar" style={{ width: `${job.progress}%` }}></div>
            </div>
            <div className="panel-subtitle">
              ID: {job.id.slice(0, 8)}… · прогресс {job.progress}%
            </div>
            {job.error && (
              <div style={{ color: "var(--status-red-text)", fontSize: "0.85rem" }}>
                Ошибка: {job.error}
              </div>
            )}
          </div>
        )}

        {/* k-anonymity panel */}
        {k && (
          <div className="panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div className="panel-title">k-анонимность</div>
              <StatusChip
                label={k.compliant ? "Соответствует" : "Не соответствует"}
                tone={k.compliant ? "green" : "red"}
              />
            </div>

            <div className="k-panel">
              <div className={`k-dial ${k.compliant ? "compliant" : "violation"}`}>
                <span className="k-value">{k.k}</span>
                <span className="k-label">k</span>
              </div>

              <div className="kpi-grid" style={{ width: "100%" }}>
                <KpiPlate label="Порог" value={k.threshold} />
                <KpiPlate label="Классы эквивалентности" value={k.equivalence_classes} />
                <KpiPlate label="Всего записей" value={k.total_records} />
                {typeof k.k_before_generalization === "number" && (
                  <KpiPlate
                    label="k до обобщения"
                    value={k.k_before_generalization}
                    accent="muted"
                    hint={`после: ${k.k}`}
                  />
                )}
              </div>
            </div>

            <div className="panel-subtitle">
              Квазиидентификаторы: {k.quasi_identifiers.join(", ") || "—"}
              {k.smallest_class_example ? ` · мин. класс: ${k.smallest_class_example}` : ""}
            </div>
          </div>
        )}

        {/* Mode-specific proof */}
        {result?.pseudonymization && (
          <div className="panel">
            <div className="panel-title">Псевдонимизация (обратимо)</div>
            <div className="kpi-grid">
              <KpiPlate
                label="Полей токенизировано"
                value={result.pseudonymization.fields_tokenized.length}
              />
              <KpiPlate label="Записей в vault" value={result.pseudonymization.mappings_written} />
              <KpiPlate
                label="Обратимость"
                value={result.pseudonymization.reversible ? "Да" : "Нет"}
                accent={result.pseudonymization.reversible ? "green" : "red"}
              />
            </div>
            <div className="panel-subtitle">{result.pseudonymization.reversibility_check}</div>
          </div>
        )}

        {result?.anonymization && (
          <div className="panel">
            <div className="panel-title">Анонимизация (необратимо)</div>
            <div className="kpi-grid">
              <KpiPlate
                label="Удалено идентификаторов"
                value={result.anonymization.direct_identifiers_removed.length}
              />
              <KpiPlate
                label="Замаскировано полей"
                value={result.anonymization.masked_fields.length}
              />
              <KpiPlate
                label="Обобщено полей"
                value={result.anonymization.generalized_fields.length}
              />
              <KpiPlate
                label="Записей в vault"
                value={result.anonymization.pseudonym_map_writes}
                accent={result.anonymization.pseudonym_map_writes === 0 ? "green" : "red"}
                hint="должно быть 0"
              />
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}

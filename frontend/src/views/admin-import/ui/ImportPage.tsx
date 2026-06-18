"use client";

import React, { useRef, useState } from "react";
import { AdminShell } from "@/widgets/admin-shell";
import { ApiError } from "@/shared/api";
import { KpiPlate } from "@/shared/ui";
import {
  JobStatusBadge,
  uploadDataset,
  useJobPolling,
  type EntityReport,
  type ImportResult,
} from "@/entities/job";

const ACCEPT = ".csv,.xlsx";

export function ImportPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { job, start, reset } = useJobPolling();

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const next = Array.from(incoming).filter((f) => /\.(csv|xlsx)$/i.test(f.name));
    setFiles((prev) => {
      const byName = new Map(prev.map((f) => [f.name, f]));
      for (const f of next) byName.set(f.name, f);
      return Array.from(byName.values());
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const removeFile = (name: string) => setFiles((prev) => prev.filter((f) => f.name !== name));

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    setError(null);
    reset();
    try {
      const created = await uploadDataset(files);
      start(created);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось загрузить файлы");
    } finally {
      setUploading(false);
    }
  };

  const result = job?.status === "done" ? (job.result as ImportResult | undefined) : undefined;
  const entities: [string, EntityReport | undefined][] = result
    ? [
        ["Обучающиеся", result.students],
        ["Законные представители", result.guardians],
        ["Связи", result.links],
      ]
    : [];
  const totals = entities.reduce(
    (acc, [, r]) => {
      if (r) {
        acc.total += r.total;
        acc.inserted += r.inserted;
        acc.skipped += r.skipped;
        acc.failed += r.failed;
      }
      return acc;
    },
    { total: 0, inserted: 0, skipped: 0, failed: 0 }
  );
  const rowErrors = entities.flatMap(([label, r]) =>
    (r?.errors ?? []).map((e) => ({ entity: label, ...e }))
  );

  return (
    <AdminShell eyebrow="Администрирование · Защита данных" title="Импорт данных">
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {/* Upload panel */}
        <div className="panel">
          <div>
            <div className="panel-title">Загрузка набора данных</div>
            <div className="panel-subtitle">
              Поддерживаются файлы students / guardians / student_guardian в формате CSV или Excel.
              Можно перетащить несколько файлов сразу.
            </div>
          </div>

          <div
            className={`dropzone${dragging ? " dragging" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
          >
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              multiple
              hidden
              onChange={(e) => addFiles(e.target.files)}
            />
            <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>
              Перетащите файлы сюда
            </div>
            <div style={{ fontSize: "0.82rem", marginTop: "6px" }}>
              или нажмите, чтобы выбрать на диске
            </div>
          </div>

          {files.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {files.map((f) => (
                <div key={f.name} className="field-row">
                  <span className="field-name">{f.name}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span className="panel-subtitle">{(f.size / 1024).toFixed(1)} КБ</span>
                    <button
                      type="button"
                      onClick={() => removeFile(f.name)}
                      style={{
                        border: "none",
                        background: "transparent",
                        color: "var(--status-red-text)",
                        cursor: "pointer",
                        fontSize: "0.82rem",
                      }}
                    >
                      Убрать
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

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

          <button
            type="button"
            className="btn btn-primary"
            style={{ width: "auto", alignSelf: "flex-start" }}
            disabled={files.length === 0 || uploading}
            onClick={handleUpload}
          >
            {uploading ? "Загрузка…" : "Загрузить и импортировать"}
          </button>
        </div>

        {/* Job status */}
        {job && (
          <div className="panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div className="panel-title">Задача импорта</div>
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

        {/* Counters + row errors */}
        {result && (
          <>
            <div className="kpi-grid">
              <KpiPlate label="Всего строк" value={totals.total} />
              <KpiPlate label="Добавлено" value={totals.inserted} accent="green" />
              <KpiPlate label="Пропущено" value={totals.skipped} accent="muted" />
              <KpiPlate
                label="С ошибками"
                value={totals.failed}
                accent={totals.failed > 0 ? "red" : undefined}
              />
            </div>

            <div className="panel">
              <div className="panel-title">Разбор по сущностям</div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Сущность</th>
                    <th>Файл</th>
                    <th>Всего</th>
                    <th>Добавлено</th>
                    <th>Пропущено</th>
                    <th>Ошибки</th>
                  </tr>
                </thead>
                <tbody>
                  {entities
                    .filter(([, r]) => r)
                    .map(([label, r]) => (
                      <tr key={label}>
                        <td>{label}</td>
                        <td>{r!.file}</td>
                        <td>{r!.total}</td>
                        <td>{r!.inserted}</td>
                        <td>{r!.skipped}</td>
                        <td>{r!.failed}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {rowErrors.length > 0 && (
              <div className="panel">
                <div className="panel-title">Построчные ошибки ({rowErrors.length})</div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Сущность</th>
                      <th>Строка</th>
                      <th>Причина</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rowErrors.map((e, i) => (
                      <tr key={`${e.entity}-${e.row}-${i}`}>
                        <td>{e.entity}</td>
                        <td>{e.row}</td>
                        <td style={{ color: "var(--status-red-text)" }}>{e.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </AdminShell>
  );
}

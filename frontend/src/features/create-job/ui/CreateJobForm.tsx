"use client";

import React, { useState } from "react";
import { createJob, type JobResponse } from "@/entities/job";

interface CreateJobFormProps {
  onJobCreated: (job: JobResponse) => void;
}

export function CreateJobForm({ onJobCreated }: CreateJobFormProps) {
  const [jobType, setJobType] = useState<"import" | "anonymize">("import");
  const [filePath, setFilePath] = useState("/data/synthetic_students.csv");
  const [datasetId, setDatasetId] = useState("sirius-dataset-2026");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload =
        jobType === "import"
          ? { file_path: filePath }
          : { dataset_id: datasetId };

      const job = await createJob(jobType, payload);
      onJobCreated(job);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось запустить задачу");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bento-card col-6" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <h2 className="section-title">Запуск новой задачи</h2>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        
        <div className="form-group">
          <label className="form-label">Тип операции</label>
          <div style={{ display: "flex", gap: "12px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "0.9rem" }}>
              <input
                type="radio"
                name="jobType"
                checked={jobType === "import"}
                onChange={() => setJobType("import")}
                disabled={loading}
                style={{ accentColor: "var(--color-primary-blue)" }}
              />
              Импорт списка обучающихся
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "0.9rem" }}>
              <input
                type="radio"
                name="jobType"
                checked={jobType === "anonymize"}
                onChange={() => setJobType("anonymize")}
                disabled={loading}
                style={{ accentColor: "var(--color-primary-blue)" }}
              />
              Анонимизация датасета (k-анонимность)
            </label>
          </div>
        </div>

        {jobType === "import" ? (
          <div className="form-group">
            <label className="form-label" htmlFor="file-path">Путь к файлу данных (CSV/Excel)</label>
            <input
              id="file-path"
              type="text"
              className="form-control"
              value={filePath}
              onChange={(e) => setFilePath(e.target.value)}
              required
              disabled={loading}
              placeholder="Например, /data/students.csv"
            />
          </div>
        ) : (
          <div className="form-group">
            <label className="form-label" htmlFor="dataset-id">Идентификатор набора данных (PostgreSQL)</label>
            <input
              id="dataset-id"
              type="text"
              className="form-control"
              value={datasetId}
              onChange={(e) => setDatasetId(e.target.value)}
              required
              disabled={loading}
              placeholder="Например, dataset-v1"
            />
          </div>
        )}

        {error && (
          <div style={{ fontSize: "0.8rem", color: "var(--status-red-text)", backgroundColor: "var(--status-red-bg)", padding: "8px", borderRadius: "6px" }}>
            Ошибка: {error}
          </div>
        )}

        <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: "8px" }}>
          {loading ? "Запуск..." : "Запустить задачу"}
        </button>
      </form>
    </div>
  );
}

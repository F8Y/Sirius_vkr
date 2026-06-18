import React from "react";
import type { JobResponse } from "../model/types";
import { JobStatusBadge } from "./JobStatusBadge";

interface JobProgressCardProps {
  job: JobResponse;
}

function jobTypeLabel(type: string): string {
  return type === "import" ? "Импорт данных" : "Обезличивание данных";
}

function formatTime(isoString: string): string {
  try {
    return new Date(isoString).toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return isoString;
  }
}

export function JobProgressCard({ job }: JobProgressCardProps) {
  return (
    <div className="job-item">
      <div className="job-header">
        <div>
          <span style={{ fontWeight: 700, fontSize: "1rem", marginRight: "8px" }}>
            {jobTypeLabel(job.type)}
          </span>
          <span className="job-meta">
            ID: <span className="job-id">{job.id.slice(0, 8)}…</span>
          </span>
        </div>
        <JobStatusBadge status={job.status} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "0.85rem",
            color: "var(--text-secondary)",
          }}
        >
          <span>Прогресс: {job.progress}%</span>
          <span>Создано: {formatTime(job.created_at)}</span>
        </div>

        <div className="progress-container">
          <div className="progress-bar" style={{ width: `${job.progress}%` }}></div>
        </div>
      </div>

      {job.error && (
        <div style={{ fontSize: "0.8rem", color: "var(--status-red-text)", marginTop: "4px" }}>
          <strong>Ошибка:</strong> {job.error}
        </div>
      )}
    </div>
  );
}

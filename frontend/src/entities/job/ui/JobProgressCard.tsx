import React from "react";
import { JobResponse } from "../model/types";

interface JobProgressCardProps {
  job: JobResponse;
}

export function JobProgressCard({ job }: JobProgressCardProps) {
  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return "В очереди";
      case "processing":
        return "В работе";
      case "done":
        return "Выполнено";
      case "failed":
        return "Ошибка";
      default:
        return status;
    }
  };

  const getJobTypeLabel = (type: string) => {
    return type === "import" ? "Импорт данных" : "Анонимизация данных";
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="job-item">
      <div className="job-header">
        <div>
          <span style={{ fontWeight: 700, fontSize: "1rem", marginRight: "8px" }}>
            {getJobTypeLabel(job.type)}
          </span>
          <span className="job-meta">
            ID: <span className="job-id">{job.id.slice(0, 8)}...</span>
          </span>
        </div>
        <span className={`status-badge ${job.status}`}>
          {getStatusLabel(job.status)}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
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

      {job.result && job.status === "done" && (
        <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "4px", backgroundColor: "var(--bg-primary)", padding: "8px", borderRadius: "6px" }}>
          <div>📋 {job.result.message}</div>
          <div style={{ display: "flex", gap: "16px", marginTop: "4px", fontSize: "0.75rem" }}>
            <span>Обработано записей: {job.result.processed_records}</span>
            <span>Время выполнения: {job.result.elapsed_ms} мс</span>
          </div>
        </div>
      )}
    </div>
  );
}

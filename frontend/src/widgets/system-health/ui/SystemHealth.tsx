"use client";

import React, { useEffect, useState } from "react";
import { fetchHealth, type HealthResponse } from "@/shared/api";

export function SystemHealth() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const data = await fetchHealth();
        setHealth(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Нет соединения с бэкендом");
        setHealth(null);
      } finally {
        setLoading(false);
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  const getStatusClass = (status: string | undefined) => {
    if (loading) return "health-dot";
    return status === "ok" ? "health-dot ok" : "health-dot error";
  };

  const getStatusText = (status: string | undefined) => {
    if (loading) return "Загрузка...";
    if (status === "ok") return "Активен";
    return status ? `Ошибка (${status})` : "Недоступен";
  };

  return (
    <div className="bento-card col-4">
      <h2 className="section-title">Состояние системы</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "16px" }}>
        
        <div className="health-row">
          <span className="health-service">API бэкенда</span>
          <div className="health-status">
            <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
              {error ? "Недоступен" : "В сети"}
            </span>
            <span className={error ? "health-dot error" : "health-dot ok"}></span>
          </div>
        </div>

        <div className="health-row">
          <span className="health-service">PostgreSQL</span>
          <div className="health-status">
            <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
              {getStatusText(health?.services.postgres)}
            </span>
            <span className={getStatusClass(health?.services.postgres)}></span>
          </div>
        </div>

        <div className="health-row">
          <span className="health-service">Redis Queue</span>
          <div className="health-status">
            <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
              {getStatusText(health?.services.redis)}
            </span>
            <span className={getStatusClass(health?.services.redis)}></span>
          </div>
        </div>
        
      </div>
      {error && (
        <div style={{ marginTop: "12px", fontSize: "0.75rem", color: "var(--status-red-text)", backgroundColor: "var(--status-red-bg)", padding: "8px", borderRadius: "6px" }}>
          Соединение с сервером потеряно: {error}
        </div>
      )}
    </div>
  );
}

"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/shared/api";
import { isAdmin, useAuth } from "@/entities/session";

const ADMIN_HOME = "/admin/data/import";

export function LoginPage() {
  const { user, loading, login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already signed in → skip the form.
  useEffect(() => {
    if (!loading && user && isAdmin(user)) router.replace(ADMIN_HOME);
  }, [loading, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const me = await login(email, password);
      if (isAdmin(me)) {
        router.replace(ADMIN_HOME);
      } else {
        setError("Этот контур доступен только администратору безопасности.");
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Не удалось войти. Проверьте данные и попробуйте снова."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Brand panel */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: "20px",
          padding: "48px",
          background:
            "linear-gradient(135deg, rgba(28,160,196,0.14) 0%, rgba(141,198,63,0.14) 100%)",
        }}
        className="login-brand-panel"
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            className="logo-circle"
            style={{ width: "56px", height: "56px", fontSize: "1.4rem" }}
          >
            С
          </div>
          <div>
            <div className="logo-text" style={{ fontSize: "1.4rem" }}>
              Сириус 27
            </div>
            <div className="logo-subtext">образовательная платформа</div>
          </div>
        </div>
        <h1 style={{ fontSize: "1.9rem", fontWeight: 800, maxWidth: "420px" }}>
          Контур защиты персональных данных
        </h1>
        <p style={{ color: "var(--text-secondary)", maxWidth: "420px", lineHeight: 1.6 }}>
          Импорт, обезличивание и учёт согласий в соответствии с требованиями 152-ФЗ. Вход открыт
          администратору безопасности.
        </p>
      </div>

      {/* Form panel */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px",
        }}
      >
        <form
          onSubmit={handleSubmit}
          style={{
            width: "100%",
            maxWidth: "360px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <h2 style={{ fontSize: "1.4rem", fontWeight: 800 }}>Вход</h2>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="email">
              Электронная почта
            </label>
            <input
              id="email"
              type="email"
              className="form-control"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
              disabled={submitting}
              placeholder="admin@sirius27.local"
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="password">
              Пароль
            </label>
            <input
              id="password"
              type="password"
              className="form-control"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              disabled={submitting}
            />
          </div>

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

          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Вход…" : "Войти"}
          </button>
        </form>
      </div>
    </div>
  );
}

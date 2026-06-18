import React from "react";

/**
 * Neutral white KPI plate with a large figure (DESIGN_BRIEF §3 — KPI plates stay
 * neutral, no decorative colour). `accent` optionally tints only the value.
 */
export function KpiPlate({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  accent?: "blue" | "green" | "red" | "muted";
}) {
  const accentColor =
    accent === "blue"
      ? "var(--color-primary-blue)"
      : accent === "green"
        ? "var(--status-green-text)"
        : accent === "red"
          ? "var(--status-red-text)"
          : accent === "muted"
            ? "var(--text-secondary)"
            : "var(--text-primary)";
  return (
    <div
      style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-color)",
        borderRadius: "var(--border-radius-card)",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
      }}
    >
      <span
        style={{
          fontSize: "0.75rem",
          fontWeight: 600,
          color: "var(--text-secondary)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: "2rem", fontWeight: 800, color: accentColor, lineHeight: 1.1 }}>
        {value}
      </span>
      {hint && <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>{hint}</span>}
    </div>
  );
}

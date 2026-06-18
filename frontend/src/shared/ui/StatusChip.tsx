import React from "react";

export type ChipTone = "green" | "blue" | "yellow" | "red" | "neutral";

const TONE_STYLE: Record<ChipTone, { bg: string; color: string }> = {
  green: { bg: "var(--status-green-bg)", color: "var(--status-green-text)" },
  blue: { bg: "var(--status-blue-bg)", color: "var(--status-blue-text)" },
  yellow: { bg: "var(--status-yellow-bg)", color: "var(--status-yellow-text)" },
  red: { bg: "var(--status-red-bg)", color: "var(--status-red-text)" },
  neutral: { bg: "var(--border-color)", color: "var(--text-secondary)" },
};

/**
 * Status is communicated ONLY through a chip (DESIGN_BRIEF §3). Keep colour out
 * of free text — pass the semantic tone here instead.
 */
export function StatusChip({ label, tone = "neutral" }: { label: string; tone?: ChipTone }) {
  const s = TONE_STYLE[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        fontSize: "0.72rem",
        fontWeight: 700,
        borderRadius: "9999px",
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        backgroundColor: s.bg,
        color: s.color,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

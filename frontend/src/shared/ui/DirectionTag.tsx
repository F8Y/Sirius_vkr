import React from "react";
import { directionColor, directionLabel } from "@/shared/lib/direction";

/**
 * Direction tag — the only place a direction's colour appears (DESIGN_BRIEF §3).
 * Saturated fill in the direction colour with white text on light surfaces; over
 * a coloured cover (`onColor`) it flips to a frosted-white pill with coloured text.
 */
export function DirectionTag({
  direction,
  onColor = false,
}: {
  direction?: string | null;
  onColor?: boolean;
}) {
  const color = directionColor(direction);
  const palette = onColor
    ? { backgroundColor: "rgba(255, 255, 255, 0.92)", color }
    : { backgroundColor: color, color: "#fff" };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 10px",
        fontSize: "0.7rem",
        fontWeight: 700,
        borderRadius: "9999px",
        ...palette,
        whiteSpace: "nowrap",
      }}
    >
      {directionLabel(direction)}
    </span>
  );
}

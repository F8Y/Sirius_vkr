import React from "react";
import { directionColor, directionLabel } from "@/shared/lib/direction";

/**
 * Direction tag — the only place a direction's colour appears (DESIGN_BRIEF §3).
 * Soft tinted background + saturated text in the direction colour.
 */
export function DirectionTag({ direction }: { direction?: string | null }) {
  const color = directionColor(direction);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 10px",
        fontSize: "0.7rem",
        fontWeight: 700,
        borderRadius: "9999px",
        backgroundColor: `${color}1f`,
        color,
        whiteSpace: "nowrap",
      }}
    >
      {directionLabel(direction)}
    </span>
  );
}

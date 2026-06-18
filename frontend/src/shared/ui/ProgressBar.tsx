import React from "react";

/**
 * Progress bar — a single accent colour (blue) for ALL progress, never a
 * rainbow (DESIGN_BRIEF §3). `tint` lets the student portal cover tint it to a
 * direction colour where a course cover calls for it.
 */
export function ProgressBar({ value, tint }: { value: number; tint?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="progress-container" aria-label={`Прогресс ${pct}%`}>
      <div
        className="progress-bar"
        style={{ width: `${pct}%`, ...(tint ? { backgroundColor: tint } : {}) }}
      />
    </div>
  );
}

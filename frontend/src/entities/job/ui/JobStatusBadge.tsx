import React from "react";
import { StatusChip, type ChipTone } from "@/shared/ui";
import type { JobStatus } from "../model/types";

const MAP: Record<JobStatus, { label: string; tone: ChipTone }> = {
  pending: { label: "В очереди", tone: "yellow" },
  processing: { label: "В работе", tone: "blue" },
  done: { label: "Выполнено", tone: "green" },
  failed: { label: "Ошибка", tone: "red" },
};

/** Job status — communicated only through a chip (DESIGN_BRIEF §3). */
export function JobStatusBadge({ status }: { status: JobStatus }) {
  const { label, tone } = MAP[status];
  return <StatusChip label={label} tone={tone} />;
}

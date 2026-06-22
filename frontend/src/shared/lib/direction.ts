/**
 * Direction → colour mapping (DESIGN_BRIEF §2): the direction is conveyed ONLY
 * through a tag/cover colour, never through status or progress. Наука — синий,
 * Искусство — фиолетовый, Спорт — оранжевый; anything else falls back to the
 * brand teal so unknown directions still read as a neutral category.
 */
const DIRECTION_COLOR: Record<string, string> = {
  Наука: "#2f6bff",
  Искусство: "#8b5cf6",
  Спорт: "#f59e0b",
};

const FALLBACK = "#1ca0c4";

export function directionColor(direction?: string | null): string {
  if (!direction) return FALLBACK;
  return DIRECTION_COLOR[direction] ?? FALLBACK;
}

export function directionLabel(direction?: string | null): string {
  return direction && direction.trim() ? direction : "Без направления";
}

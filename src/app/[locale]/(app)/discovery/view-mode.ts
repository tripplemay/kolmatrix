/**
 * MVP-vf-F002 · /discovery view mode helpers.
 *
 * Pure utility used by the page (`?view=grid|list` URL param parsing)
 * and `SummaryBar` (the toggle UI). Lives in its own module so the
 * page tree avoids 'use client' churn.
 */
export type ViewMode = "grid" | "list";

export function parseView(
  raw: Record<string, string | string[] | undefined>
): ViewMode {
  const v = raw.view;
  const value = Array.isArray(v) ? v[0] : v;
  return value === "list" ? "list" : "grid";
}

/**
 * BL-065-F001 · /match view-mode parser.
 *
 * `?view=table` flips the main pane to the dense table layout (inherits
 * the /database row + checkbox selection model). Any other value — or no
 * param — lands on the card grid (BL-065 spec §4 决策点 #F: 默认卡片).
 *
 * The legacy `?view=campaigns` deep-link emitted by the BL-064 redirect
 * from /campaigns → /match (and similar grid/list aliases from old
 * /discovery URLs) fall through to "card" so bookmarked links never 500.
 */
export type ViewMode = "card" | "table";

export function parseView(
  raw: Record<string, string | string[] | undefined>,
): ViewMode {
  const v = raw.view;
  const value = Array.isArray(v) ? v[0] : v;
  return value === "table" ? "table" : "card";
}

/**
 * BL-084-F007 · AI Match Panel vs full-pool resolution.
 *
 * Orthogonal to {@link parseView} (table/card layout of the full pool):
 *   - `?view=ai`        → AI recommendation panel
 *   - `?view=full-pool` → full KOL pool (legacy BM1 workbench)
 *   - no `view` + a campaignId → AI panel (default for the campaign deep-link)
 *   - no `view` + no campaignId → full pool
 *
 * `view=table` / `view=card` are full-pool layout signals → "full-pool".
 */
export type AiView = "ai" | "full-pool";

export function parseAiView(
  raw: Record<string, string | string[] | undefined>,
  campaignId: string | null,
): AiView {
  const v = raw.view;
  const value = Array.isArray(v) ? v[0] : v;
  if (value === "ai") return "ai";
  if (value === undefined && campaignId) return "ai";
  return "full-pool";
}

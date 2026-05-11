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

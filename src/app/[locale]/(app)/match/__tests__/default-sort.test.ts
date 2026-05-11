/**
 * BL-065-F001 · /match default-sort regression guard.
 *
 * Spec §3 F001 acceptance #4: "默认排序 valueScore desc（apify-kol 单源
 * 全量池，无 isSaved filter）". The behavior is driven by the existing
 * BM1 `parseFilters` + `sortToOrderBy` pair, but we lock the expectation
 * here so a future filter refactor cannot silently flip the Match-page
 * default order without breaking this test.
 *
 * Two locked invariants:
 *   1. `parseFilters({})` ⇒ `sort: "value"` (the URL-default).
 *   2. `sortToOrderBy("value")` ⇒ desc on `valueScore` with NULLs sunk
 *      to the bottom (BL-035-F012 — mock seeds with NULL valueScore must
 *      not crown the workbench).
 */
import { describe, expect, it } from "vitest";

import { parseFilters, sortToOrderBy } from "@/lib/kol/filters";

describe("match default sort (BL-065-F001)", () => {
  it("parseFilters with no URL params defaults to sort='value'", () => {
    const filters = parseFilters({});
    expect(filters.sort).toBe("value");
  });

  it("sortToOrderBy('value') yields valueScore desc with nulls last", () => {
    const result = sortToOrderBy("value");
    expect(result).toEqual({
      field: "valueScore",
      direction: "desc",
      nulls: "last",
    });
  });

  it("an unknown ?sort= value in the URL still falls back to 'value'", () => {
    const filters = parseFilters({ sort: "garbage-value" });
    expect(filters.sort).toBe("value");
  });
});

/**
 * BL-065-F001 · /match view-mode parser tests.
 *
 * MatchSummaryBar selects the active toggle off `parseView(searchParams)`
 * and page.tsx routes between MatchKolCard grid vs MatchKolTable based on
 * the same parsed value. If parsing drifts (e.g. accepts "Table" or "1"
 * as truthy) the wrong view renders and the visual + e2e baselines drift.
 *
 * Default per spec §4 决策点 #F: card. Only the literal string "table"
 * flips the view; everything else (including the legacy /discovery
 * "list" and the BL-064 redirect alias "campaigns") stays on card.
 */
import { describe, expect, it } from "vitest";

import { parseView } from "../view-mode";

describe("match view-mode parser", () => {
  it("defaults to card when no view param is present", () => {
    expect(parseView({})).toBe("card");
  });

  it("returns 'table' only for the exact literal string 'table'", () => {
    expect(parseView({ view: "table" })).toBe("table");
    expect(parseView({ view: "Table" })).toBe("card");
    expect(parseView({ view: "TABLE" })).toBe("card");
    expect(parseView({ view: "" })).toBe("card");
  });

  it("treats discovery / campaign deep-link aliases as card (BL-064 fallback)", () => {
    expect(parseView({ view: "grid" })).toBe("card");
    expect(parseView({ view: "list" })).toBe("card");
    expect(parseView({ view: "campaigns" })).toBe("card");
  });

  it("treats undefined / empty array input as card", () => {
    expect(parseView({ view: undefined })).toBe("card");
    expect(parseView({ view: [] })).toBe("card");
  });

  it("accepts the array shape produced by Next searchParams", () => {
    expect(parseView({ view: ["table"] })).toBe("table");
    expect(parseView({ view: ["card"] })).toBe("card");
    expect(parseView({ view: ["table", "card"] })).toBe("table");
  });
});

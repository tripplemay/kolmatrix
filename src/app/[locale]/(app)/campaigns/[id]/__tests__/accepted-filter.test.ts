/**
 * BL-110-F003 · isAcceptedKolRow read口径 unit specs.
 *
 * Locks the contract that drives both AcceptedKolsPanel and the
 * campaign-detail acceptedCount: a row is "accepted" iff its source is
 * a visible add-to-campaign path AND its suggestionStatus is accepted
 * or NULL. The AI Match panel writes source="ai_smart_match" for skip
 * AND swap, so source alone would leak those into the accepted list.
 */
import { describe, expect, it } from "vitest";

import { isAcceptedKolRow } from "../accepted-filter";

describe("isAcceptedKolRow (BL-110-F003)", () => {
  it("shows AI-panel accepted rows", () => {
    expect(
      isAcceptedKolRow({ source: "ai_smart_match", suggestionStatus: "accepted" })
    ).toBe(true);
  });

  it("hides AI-panel skipped rows (source=ai_smart_match leaked before)", () => {
    expect(
      isAcceptedKolRow({ source: "ai_smart_match", suggestionStatus: "skipped" })
    ).toBe(false);
  });

  it("hides AI-panel swap_pool rows", () => {
    expect(
      isAcceptedKolRow({ source: "ai_smart_match", suggestionStatus: "swap_pool" })
    ).toBe(false);
  });

  it("shows detail-page direct accepts / ADR-016 legacy rows with NULL suggestionStatus", () => {
    expect(
      isAcceptedKolRow({ source: "ai_smart_match", suggestionStatus: null })
    ).toBe(true);
  });

  it("shows csv_import and manual_legacy rows (NULL lifecycle)", () => {
    expect(isAcceptedKolRow({ source: "csv_import", suggestionStatus: null })).toBe(true);
    expect(isAcceptedKolRow({ source: "manual_legacy", suggestionStatus: null })).toBe(true);
  });

  it("shows csv_import even if it somehow carries accepted", () => {
    expect(
      isAcceptedKolRow({ source: "csv_import", suggestionStatus: "accepted" })
    ).toBe(true);
  });

  it("hides rows whose source is outside the whitelist", () => {
    expect(isAcceptedKolRow({ source: "manual", suggestionStatus: "accepted" })).toBe(false);
    expect(isAcceptedKolRow({ source: "manual", suggestionStatus: null })).toBe(false);
    expect(isAcceptedKolRow({ source: "unknown_future", suggestionStatus: null })).toBe(false);
  });
});

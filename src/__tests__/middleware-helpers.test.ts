/**
 * middleware-helpers unit tests.
 *
 * BL-070-F004 二次清理 — every legacy redirect rule was removed and the
 * 8 deleted top-level routes (`/dashboard` `/discovery` `/database`
 * `/emails` `/knowledge-base` `/analytics` `/weekly-report`
 * `/outreach`) are no longer protected, so this spec is now a pure
 * "new IA only" surface:
 *   - PROTECTED_PREFIXES covers only the 4 IA routes + the kept
 *     sub-routes (/kols /campaigns /crm /roi /settings)
 *   - `resolveIaRefactorRedirect` returns null for everything,
 *     including every retired path (which 404 outright)
 *   - `stripLocale` is unchanged
 */
import { describe, expect, it } from "vitest";

import { resolveIaRefactorRedirect, isProtected, stripLocale } from "../middleware-helpers";

describe("stripLocale (existing helper, sanity check)", () => {
  it("strips supported locale prefixes", () => {
    expect(stripLocale("/en/insight")).toBe("/insight");
    expect(stripLocale("/zh/campaigns/abc")).toBe("/campaigns/abc");
    expect(stripLocale("/ja")).toBe("/");
  });
  it("leaves bare path untouched", () => {
    expect(stripLocale("/insight")).toBe("/insight");
    expect(stripLocale("/")).toBe("/");
  });
});

describe("isProtected — BL-070-F004 trimmed list (4 IA + kept sub-routes)", () => {
  it("protects the 4 new IA top-level routes + their nested paths", () => {
    expect(isProtected("/brief")).toBe(true);
    expect(isProtected("/match")).toBe(true);
    expect(isProtected("/reach")).toBe(true);
    expect(isProtected("/insight")).toBe(true);
    expect(isProtected("/brief/anything")).toBe(true);
    expect(isProtected("/insight/weekly-report/abc")).toBe(true);
  });

  it("protects the kept sub-routes (kols / campaigns / crm / roi / settings)", () => {
    expect(isProtected("/kols")).toBe(true);
    expect(isProtected("/kols/abc-123")).toBe(true);
    expect(isProtected("/campaigns")).toBe(true);
    expect(isProtected("/campaigns/abc-123")).toBe(true);
    expect(isProtected("/crm")).toBe(true);
    expect(isProtected("/roi")).toBe(true);
    expect(isProtected("/settings")).toBe(true);
  });

  it("no longer protects retired legacy routes — they 404 outright (BL-070-F004 cleanup)", () => {
    for (const legacy of [
      "/dashboard",
      "/discovery",
      "/database",
      "/emails",
      "/knowledge-base",
      "/knowledge-base/abc",
      "/analytics",
      "/weekly-report",
      "/outreach",
      "/outreach/templates",
      "/reports",
    ]) {
      expect(isProtected(legacy)).toBe(false);
    }
  });

  it("rejects unprotected paths", () => {
    expect(isProtected("/login")).toBe(false);
    expect(isProtected("/")).toBe(false);
    expect(isProtected("/shared/weekly-report/abc")).toBe(false);
  });
});

describe("resolveIaRefactorRedirect — BL-070-F004 cleared rule list", () => {
  it("returns null for the new IA routes + kept sub-routes", () => {
    for (const path of [
      "/",
      "/brief",
      "/match",
      "/reach",
      "/insight",
      "/login",
      "/assets",
      "/crm",
      "/kols/abc-123",
      "/settings",
      "/admin/apify-preview",
      "/roi",
      "/campaigns",
      "/campaigns/abc-123",
      "/campaigns/clxyz789",
      "/campaigns/00000000-0000-0000-0000-000000000000",
    ]) {
      expect(resolveIaRefactorRedirect(path)).toBeNull();
    }
  });

  it("returns null for every retired legacy path (BL-070-F004 redirect rules removed → 404)", () => {
    for (const path of [
      "/dashboard",
      "/dashboard/anything",
      "/discovery",
      "/database",
      "/reports",
      "/analytics",
      "/weekly-report",
      "/weekly-report/abc-123",
      "/knowledge-base",
      "/knowledge-base/cprod1111111111111111",
      "/knowledge-base/foo/bar",
      "/campaigns/new",
      "/outreach",
      "/outreach/templates",
      "/outreach/tracking",
      "/outreach/suppression",
      "/outreach/tracking/abc-123",
    ]) {
      expect(resolveIaRefactorRedirect(path)).toBeNull();
    }
  });
});

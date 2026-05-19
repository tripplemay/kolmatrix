/**
 * BL-064-F002 · middleware-helpers unit tests.
 *
 * Pure-function tests for the Phase 1 IA refactor 302 redirect map.
 * Locale handling is the middleware's concern; this layer operates on
 * locale-stripped bare paths only.
 */
import { describe, expect, it } from "vitest";

import { resolveIaRefactorRedirect, isProtected, stripLocale } from "../middleware-helpers";

describe("stripLocale (existing helper, sanity check)", () => {
  it("strips supported locale prefixes", () => {
    expect(stripLocale("/en/dashboard")).toBe("/dashboard");
    expect(stripLocale("/zh/campaigns/abc")).toBe("/campaigns/abc");
    expect(stripLocale("/ja")).toBe("/");
  });
  it("leaves bare path untouched", () => {
    expect(stripLocale("/dashboard")).toBe("/dashboard");
    expect(stripLocale("/")).toBe("/");
  });
});

describe("isProtected — BL-064-F001 added /brief /match /reach /insight", () => {
  it("includes new IA prefixes", () => {
    expect(isProtected("/brief")).toBe(true);
    expect(isProtected("/match")).toBe(true);
    expect(isProtected("/reach")).toBe(true);
    expect(isProtected("/insight")).toBe(true);
    expect(isProtected("/brief/anything")).toBe(true);
  });
  it("still protects legacy prefixes during BL-064 transition", () => {
    expect(isProtected("/dashboard")).toBe(true);
    expect(isProtected("/knowledge-base")).toBe(true);
  });
  it("rejects unprotected paths", () => {
    expect(isProtected("/login")).toBe(false);
    expect(isProtected("/")).toBe(false);
    expect(isProtected("/shared/weekly-report/abc")).toBe(false);
  });
});

describe("resolveIaRefactorRedirect — BL-064-F002", () => {
  it("returns null for paths outside the IA refactor scope", () => {
    expect(resolveIaRefactorRedirect("/")).toBeNull();
    expect(resolveIaRefactorRedirect("/brief")).toBeNull();
    expect(resolveIaRefactorRedirect("/match")).toBeNull();
    expect(resolveIaRefactorRedirect("/reach")).toBeNull();
    expect(resolveIaRefactorRedirect("/insight")).toBeNull();
    expect(resolveIaRefactorRedirect("/login")).toBeNull();
    // Adjudication #3 — these are kept, not redirected
    expect(resolveIaRefactorRedirect("/assets")).toBeNull();
    expect(resolveIaRefactorRedirect("/crm")).toBeNull();
    expect(resolveIaRefactorRedirect("/kols/abc-123")).toBeNull();
    expect(resolveIaRefactorRedirect("/settings")).toBeNull();
    expect(resolveIaRefactorRedirect("/admin/apify-preview")).toBeNull();
  });

  it("maps Phase 1 IA single-level routes (302 — BL-064 default)", () => {
    expect(resolveIaRefactorRedirect("/discovery")).toEqual({
      path: "/match",
      status: 302,
    });
    expect(resolveIaRefactorRedirect("/database")).toEqual({
      path: "/match",
      status: 302,
    });
  });

  it("BL-070-F003 — /dashboard → /insight?tab=dashboard (301 permanent)", () => {
    expect(resolveIaRefactorRedirect("/dashboard")).toEqual({
      path: "/insight?tab=dashboard",
      status: 301,
    });
  });

  it("BL-070-F003 — /reports → /insight?tab=reports (301 permanent)", () => {
    expect(resolveIaRefactorRedirect("/reports")).toEqual({
      path: "/insight?tab=reports",
      status: 301,
    });
  });

  it("BL-070-F003 — /analytics → /insight?tab=analytics (301 permanent)", () => {
    expect(resolveIaRefactorRedirect("/analytics")).toEqual({
      path: "/insight?tab=analytics",
      status: 301,
    });
  });

  it("BL-070-F003 — /weekly-report bare + sub-paths → /insight/weekly-report (301)", () => {
    expect(resolveIaRefactorRedirect("/weekly-report")).toEqual({
      path: "/insight/weekly-report",
      status: 301,
    });
    // Sub-paths inherit via prefix swap (same pattern as BL-070-F001
    // /outreach → /reach wildcard) so deep links survive the route move.
    expect(resolveIaRefactorRedirect("/weekly-report/abc-123")).toEqual({
      path: "/insight/weekly-report/abc-123",
      status: 301,
    });
  });

  it("BL-070-F001 — /outreach bare 301 permanent (route promoted to /reach)", () => {
    expect(resolveIaRefactorRedirect("/outreach")).toEqual({
      path: "/reach",
      status: 301,
    });
  });

  it("BL-070-F001 — /outreach sub-paths inherit via prefix swap (301)", () => {
    expect(resolveIaRefactorRedirect("/outreach/templates")).toEqual({
      path: "/reach/templates",
      status: 301,
    });
    expect(resolveIaRefactorRedirect("/outreach/tracking")).toEqual({
      path: "/reach/tracking",
      status: 301,
    });
    expect(resolveIaRefactorRedirect("/outreach/suppression")).toEqual({
      path: "/reach/suppression",
      status: 301,
    });
    // Trailing extras (query string is handled upstream by middleware
    // before the bare path hits this helper; we just verify nested
    // segments survive the swap intact).
    expect(resolveIaRefactorRedirect("/outreach/tracking/abc-123")).toEqual({
      path: "/reach/tracking/abc-123",
      status: 301,
    });
  });

  it("BL-069-F006 + fix-round 1 — /knowledge-base bare redirect is 301 permanent", () => {
    expect(resolveIaRefactorRedirect("/knowledge-base")).toEqual({
      path: "/brief?tab=products",
      status: 301,
    });
  });

  it("BL-069-F006 + fix-round 1 — KB deep-link preserves productId + 301", () => {
    // Product.id is cuid; the `[productId]` rule encodes the segment so
    // a future cuid that contains `&` / `=` can't break the query.
    expect(
      resolveIaRefactorRedirect("/knowledge-base/cprod1111111111111111")
    ).toEqual({
      path: "/brief?tab=products&productId=cprod1111111111111111",
      status: 301,
    });
    expect(resolveIaRefactorRedirect("/knowledge-base/foo")).toEqual({
      path: "/brief?tab=products&productId=foo",
      status: 301,
    });
  });

  it("BL-069-F006 + fix-round 1 — /campaigns/new redirects to /brief?action=new (301)", () => {
    expect(resolveIaRefactorRedirect("/campaigns/new")).toEqual({
      path: "/brief?action=new",
      status: 301,
    });
  });

  it("BL-070-F003 — /roi stays kept (Insight 仅合并 dashboard+reports)", () => {
    // /weekly-report + /analytics now redirect (asserted above);
    // /roi stays as a kept deep-link path because the Insight tabs
    // chose dashboard / reports / analytics — /roi gets folded into
    // the dashboard tab's content (it already renders ROI cards).
    expect(resolveIaRefactorRedirect("/roi")).toBeNull();
  });

  it("BL-064-F006 fix-round-3 — exact-match only for shells without sub-routes", () => {
    // /dashboard sub-paths stay null (kept legacy URL) — BL-070-F003 may
    // promote /insight to a real route but the dashboard sub-routes are
    // not in scope today.
    expect(resolveIaRefactorRedirect("/dashboard/anything")).toBeNull();
    // BL-069-F006 restricted the KB deep-link rule to a SINGLE segment
    // after `/knowledge-base/`; multi-segment paths still fall through
    // to null (they were never valid KB routes anyway).
    expect(resolveIaRefactorRedirect("/knowledge-base/foo/bar")).toBeNull();
    // /outreach sub-paths now redirect under BL-070-F001 (asserted in
    // the dedicated describe block above); they used to be null until
    // /reach was promoted from embed-old shell to a real route.
  });

  it("handles /campaigns family — list + [id] still kept (BL-066-F008)", () => {
    // /campaigns list — kept (BL-066 wires /match view=campaigns)
    expect(resolveIaRefactorRedirect("/campaigns")).toBeNull();
    // BL-066-F008 — /campaigns/[id] redirect removed; F002 wired the
    // three-section renderer back on, F008 closes the redirect loop.
    expect(resolveIaRefactorRedirect("/campaigns/abc-123")).toBeNull();
    expect(resolveIaRefactorRedirect("/campaigns/clxyz789")).toBeNull();
    expect(
      resolveIaRefactorRedirect("/campaigns/00000000-0000-0000-0000-000000000000")
    ).toBeNull();
  });
});

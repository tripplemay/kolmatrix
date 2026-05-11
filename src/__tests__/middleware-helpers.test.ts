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

  it("maps Phase 1 IA single-level routes", () => {
    expect(resolveIaRefactorRedirect("/dashboard")).toBe("/insight");
    expect(resolveIaRefactorRedirect("/discovery")).toBe("/match");
    expect(resolveIaRefactorRedirect("/database")).toBe("/match");
    expect(resolveIaRefactorRedirect("/knowledge-base")).toBe("/brief");
    expect(resolveIaRefactorRedirect("/outreach")).toBe("/reach");
  });

  it("maps analytics sub-routes to /insight (Adjudication #2 — spec '/reports' 笔误)", () => {
    expect(resolveIaRefactorRedirect("/roi")).toBe("/insight");
    expect(resolveIaRefactorRedirect("/weekly-report")).toBe("/insight");
    expect(resolveIaRefactorRedirect("/analytics")).toBe("/insight");
  });

  it("preserves sub-route paths via prefix inheritance", () => {
    expect(resolveIaRefactorRedirect("/outreach/templates")).toBe("/reach/templates");
    expect(resolveIaRefactorRedirect("/outreach/suppression")).toBe("/reach/suppression");
    expect(resolveIaRefactorRedirect("/outreach/tracking")).toBe("/reach/tracking");
    expect(resolveIaRefactorRedirect("/dashboard/anything")).toBe("/insight/anything");
    expect(resolveIaRefactorRedirect("/knowledge-base/foo/bar")).toBe("/brief/foo/bar");
  });

  it("handles /campaigns family per spec §4 #B + Adjudication #4", () => {
    // /campaigns list → /match?view=campaigns (Adjudication #4)
    expect(resolveIaRefactorRedirect("/campaigns")).toBe("/match?view=campaigns");
    // /campaigns/new → /brief?action=new (per spec §3 F002)
    expect(resolveIaRefactorRedirect("/campaigns/new")).toBe("/brief?action=new");
    // /campaigns/[id] → /match?campaignId=:id (spec §4 #B)
    expect(resolveIaRefactorRedirect("/campaigns/abc-123")).toBe(
      "/match?campaignId=abc-123"
    );
    expect(resolveIaRefactorRedirect("/campaigns/clxyz789")).toBe(
      "/match?campaignId=clxyz789"
    );
  });

  it("url-encodes campaign id (defense against weird chars)", () => {
    expect(resolveIaRefactorRedirect("/campaigns/hello%20world")).toBe(
      "/match?campaignId=hello%2520world"
    );
  });

  it("orders /campaigns rules correctly (specific before generic)", () => {
    // /campaigns/new must NOT fall into the [id] rule
    expect(resolveIaRefactorRedirect("/campaigns/new")).toBe("/brief?action=new");
    // /campaigns must NOT fall into a sub-route rule
    expect(resolveIaRefactorRedirect("/campaigns")).toBe("/match?view=campaigns");
  });
});

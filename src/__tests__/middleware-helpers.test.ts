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

  it("BL-064-F005 fix-round-2 — analytics sub-routes are kept (not redirected)", () => {
    // Original adjudication §2 mapped these to /insight, but /insight
    // embeds /dashboard (no roi/weekly-report cards). BL-070 unifies
    // these later. For now they're kept deep-link paths.
    expect(resolveIaRefactorRedirect("/roi")).toBeNull();
    expect(resolveIaRefactorRedirect("/weekly-report")).toBeNull();
    expect(resolveIaRefactorRedirect("/analytics")).toBeNull();
  });

  it("BL-064-F006 fix-round-3 — exact-match only (new IA shells have no sub-routes)", () => {
    // Sub-paths stay as kept deep-link paths; the legacy markup
    // continues to render under the original URL.
    expect(resolveIaRefactorRedirect("/outreach/templates")).toBeNull();
    expect(resolveIaRefactorRedirect("/outreach/suppression")).toBeNull();
    expect(resolveIaRefactorRedirect("/outreach/tracking")).toBeNull();
    expect(resolveIaRefactorRedirect("/dashboard/anything")).toBeNull();
    expect(resolveIaRefactorRedirect("/knowledge-base/foo/bar")).toBeNull();
  });

  it("handles /campaigns family per spec §4 #B + BL-064-F005 fix-round-2", () => {
    // /campaigns list — kept (BL-066 wires /match view=campaigns)
    expect(resolveIaRefactorRedirect("/campaigns")).toBeNull();
    // /campaigns/new — kept (BL-069 wires /brief form)
    expect(resolveIaRefactorRedirect("/campaigns/new")).toBeNull();
    // /campaigns/[id] — still redirects per adjudication §B (BL-066
    // makes /match render campaignId; until then user sees Discovery
    // with the campaignId param visible)
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

  it("orders /campaigns rules correctly — /new is kept, [id] still redirects", () => {
    expect(resolveIaRefactorRedirect("/campaigns/new")).toBeNull();
    expect(resolveIaRefactorRedirect("/campaigns/abc-123")).toBe(
      "/match?campaignId=abc-123"
    );
    expect(resolveIaRefactorRedirect("/campaigns")).toBeNull();
  });
});

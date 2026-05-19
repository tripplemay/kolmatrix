import { describe, expect, it } from "vitest";

import { NAV_ITEMS, deriveActiveNav } from "../nav-config";

describe("NAV_ITEMS — BL-064-F003 4-item IA", () => {
  it("contains exactly 4 nav items in Brief → Match → Reach → Insight order (spec §4 #D)", () => {
    expect(NAV_ITEMS.map((n) => n.id)).toEqual(["brief", "match", "reach", "insight"]);
  });

  it("each item declares href / i18nKey / descriptionKey / icon", () => {
    for (const item of NAV_ITEMS) {
      expect(item.href).toMatch(/^\/[a-z]/);
      expect(item.i18nKey).toMatch(/^nav\.[a-zA-Z]+$/);
      expect(item.descriptionKey).toMatch(/^nav\.[a-zA-Z]+Description$/);
      expect(item.icon).toMatch(/^[a-z_]+$/);
    }
  });

  it("does not list Settings as a top-level nav item (Adjudication #1 — moved to UserAvatarMenu)", () => {
    expect(NAV_ITEMS.find((n) => n.id === ("settings" as unknown))).toBeUndefined();
  });
});

describe("deriveActiveNav — BL-064-F003 4-route IA + sub-route mapping (Adjudication #3)", () => {
  it("resolves new top-level IA routes to themselves", () => {
    expect(deriveActiveNav("/en/brief")).toBe("brief");
    expect(deriveActiveNav("/zh/brief")).toBe("brief");
    expect(deriveActiveNav("/en/match")).toBe("match");
    expect(deriveActiveNav("/en/reach")).toBe("reach");
    expect(deriveActiveNav("/en/insight")).toBe("insight");
  });

  it("falls back to insight (canonical landing) for unknown paths", () => {
    expect(deriveActiveNav("/")).toBe("insight");
    expect(deriveActiveNav("/en")).toBe("insight");
    expect(deriveActiveNav("/en/some-unmapped-path")).toBe("insight");
  });

  it("BL-070-F004 — retired legacy top-level routes fall through to the default insight (their dirs were deleted in this batch and now 404)", () => {
    // These paths no longer hit deriveActiveNav in practice (middleware
    // serves 404 before nav is rendered), but the helper is also called
    // by unit tests / Storybook, so anything that doesn't match an
    // explicit branch must safely fall back to `insight` rather than
    // throwing.
    expect(deriveActiveNav("/en/dashboard")).toBe("insight");
    expect(deriveActiveNav("/en/discovery")).toBe("insight");
    expect(deriveActiveNav("/en/database")).toBe("insight");
    expect(deriveActiveNav("/en/knowledge-base")).toBe("insight");
    expect(deriveActiveNav("/en/outreach")).toBe("insight");
    expect(deriveActiveNav("/en/emails")).toBe("insight");
    expect(deriveActiveNav("/en/analytics")).toBe("insight");
    expect(deriveActiveNav("/en/weekly-report")).toBe("insight");
  });

  it("maps kept sub-routes to new IA per Adjudication #3", () => {
    // /assets → brief (KB → Asset flow lives under Brief in new IA)
    expect(deriveActiveNav("/en/assets")).toBe("brief");
    expect(deriveActiveNav("/zh/assets/something")).toBe("brief");
    // /crm → reach (CRM under email surface)
    expect(deriveActiveNav("/en/crm")).toBe("reach");
    // /kols/[id] → match (KOL detail belongs to Match selection workflow)
    expect(deriveActiveNav("/en/kols/abc-123")).toBe("match");
    // /roi → insight (ROI deep-link folds into the Insight surface)
    expect(deriveActiveNav("/en/roi")).toBe("insight");
  });

  it("BL-070-F004 — /campaigns list + [id] route to match (campaigns/new was deleted in this batch)", () => {
    expect(deriveActiveNav("/en/campaigns")).toBe("match");
    expect(deriveActiveNav("/en/campaigns/abc-123")).toBe("match");
    // /campaigns/new used to be a real creation page that nav split to
    // brief; the page was retired in F004 (brief is the canonical AI
    // creation surface now), so the deep link 404s and the helper just
    // routes to the campaigns family default.
    expect(deriveActiveNav("/en/campaigns/new")).toBe("match");
  });

  it("strips leading locale prefix for every supported locale", () => {
    expect(deriveActiveNav("/zh/brief")).toBe("brief");
    expect(deriveActiveNav("/ja/match")).toBe("match");
    expect(deriveActiveNav("/ko/reach")).toBe("reach");
    expect(deriveActiveNav("/es/insight")).toBe("insight");
  });

  it("nav-config hrefs target new IA paths only (regression — no legacy /dashboard etc.)", () => {
    const hrefs = NAV_ITEMS.map((n) => n.href).sort();
    expect(hrefs).toEqual(["/brief", "/insight", "/match", "/reach"]);
  });
});

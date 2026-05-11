import { describe, expect, it } from "vitest";

import { NAV_ITEMS, deriveActiveNav } from "../nav-config";

describe("NAV_ITEMS", () => {
  it("contains all 8 expected nav ids in canonical order", () => {
    expect(NAV_ITEMS.map((n) => n.id)).toEqual([
      "dashboard",
      "kol-discovery",
      "kol-database",
      "campaigns",
      "email-center",
      "knowledge-base",
      "analytics",
      "settings",
    ]);
  });
});

describe("deriveActiveNav", () => {
  it("defaults to dashboard for unmatched paths", () => {
    expect(deriveActiveNav("/")).toBe("dashboard");
    expect(deriveActiveNav("/en")).toBe("dashboard");
    expect(deriveActiveNav("/en/dashboard")).toBe("dashboard");
  });

  it("resolves discovery + database routes distinctly", () => {
    expect(deriveActiveNav("/en/discovery")).toBe("kol-discovery");
    expect(deriveActiveNav("/zh/discovery")).toBe("kol-discovery");
    expect(deriveActiveNav("/en/database")).toBe("kol-database");
    expect(deriveActiveNav("/zh/database")).toBe("kol-database");
    // /kols/:id (KOL profile page, F006) still highlights the Database nav
    expect(deriveActiveNav("/en/kols/abc123")).toBe("kol-database");
  });

  it("strips leading locale prefix in any supported locale", () => {
    expect(deriveActiveNav("/zh/campaigns")).toBe("campaigns");
    expect(deriveActiveNav("/ja/analytics")).toBe("analytics");
    expect(deriveActiveNav("/ko/emails")).toBe("email-center");
    expect(deriveActiveNav("/es/settings")).toBe("settings");
  });

  it("routes BM2 implemented surfaces to the correct sidebar item (NAV-003 regression)", () => {
    // BM2-F006 outreach page is the canonical Email Center entry;
    // sidebar Email Center now hrefs /outreach. /emails (legacy) and
    // /crm (BM2-F007) must still highlight Email Center.
    expect(deriveActiveNav("/en/outreach")).toBe("email-center");
    expect(deriveActiveNav("/zh/outreach")).toBe("email-center");
    expect(deriveActiveNav("/en/crm")).toBe("email-center");
    expect(deriveActiveNav("/en/emails")).toBe("email-center");
    // BM2-F009 ROI is the canonical Analytics entry; Analytics
    // sidebar now hrefs /roi. /analytics (legacy) + /weekly-report
    // (BM2-F010) keep highlighting Analytics.
    expect(deriveActiveNav("/en/roi")).toBe("analytics");
    expect(deriveActiveNav("/en/analytics")).toBe("analytics");
    expect(deriveActiveNav("/en/weekly-report")).toBe("analytics");
  });

  it("Email Center href targets implemented BM2 surface, not 404 (NAV-003 regression)", () => {
    const emailCenter = NAV_ITEMS.find((n) => n.id === "email-center");
    const analytics = NAV_ITEMS.find((n) => n.id === "analytics");
    expect(emailCenter?.href).toBe("/outreach");
    expect(analytics?.href).toBe("/roi");
  });

  it("resolves /knowledge-base to the Knowledge Base nav", () => {
    expect(deriveActiveNav("/en/knowledge-base")).toBe("knowledge-base");
    expect(deriveActiveNav("/zh/knowledge-base")).toBe("knowledge-base");
  });

  it("BL-064-F001 — new IA shells highlight content-equivalent legacy nav", () => {
    // F001 阶段 SidebarNav 仍是旧 8-item IA；F003 切 4-item 后这段会一并改。
    // 当前断言：访问新路由壳 /brief /match /reach /insight 时，nav 高亮内容
    // 对应的旧 nav id（/brief embed KB / /match embed Discovery 等）。
    expect(deriveActiveNav("/en/brief")).toBe("knowledge-base");
    expect(deriveActiveNav("/zh/brief")).toBe("knowledge-base");
    expect(deriveActiveNav("/en/match")).toBe("kol-discovery");
    expect(deriveActiveNav("/zh/match")).toBe("kol-discovery");
    expect(deriveActiveNav("/en/reach")).toBe("email-center");
    expect(deriveActiveNav("/zh/reach")).toBe("email-center");
    expect(deriveActiveNav("/en/insight")).toBe("dashboard");
    expect(deriveActiveNav("/zh/insight")).toBe("dashboard");
  });
});

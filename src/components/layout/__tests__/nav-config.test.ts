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

  it("resolves nested KOL routes correctly", () => {
    expect(deriveActiveNav("/en/kols/discover")).toBe("kol-discovery");
    expect(deriveActiveNav("/en/kols")).toBe("kol-database");
    expect(deriveActiveNav("/en/kols/abc123")).toBe("kol-database");
  });

  it("strips leading locale prefix in any supported locale", () => {
    expect(deriveActiveNav("/zh/campaigns")).toBe("campaigns");
    expect(deriveActiveNav("/ja/analytics")).toBe("analytics");
    expect(deriveActiveNav("/ko/emails")).toBe("email-center");
    expect(deriveActiveNav("/es/settings")).toBe("settings");
  });

  it("resolves /knowledge-base to the Knowledge Base nav", () => {
    expect(deriveActiveNav("/en/knowledge-base")).toBe("knowledge-base");
    expect(deriveActiveNav("/zh/knowledge-base")).toBe("knowledge-base");
  });
});

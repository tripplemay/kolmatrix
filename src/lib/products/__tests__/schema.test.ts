import { describe, expect, it } from "vitest";

import { createProductSchema, PRODUCT_PLATFORMS, type ProductPlatform } from "../schema";

describe("createProductSchema", () => {
  it("accepts a full happy-path payload", () => {
    const parsed = createProductSchema.safeParse({
      name: "Honor of Kings",
      category: "MOBA",
      targetAudience: "APAC 18-25 mobile gamers",
      uniqueSellingPoints: "Daily tournaments + seasonal skins",
      downloadUrl: "https://example.com/honor-of-kings",
      launchDate: "2026-11-01",
      platforms: ["mobile", "pc"],
      generateImmediately: true,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.platforms).toEqual(["mobile", "pc"]);
      expect(parsed.data.generateImmediately).toBe(true);
    }
  });

  it("accepts minimal required fields + applies defaults", () => {
    const parsed = createProductSchema.safeParse({
      name: "Minimal",
      category: "RPG",
      targetAudience: "Gamers aged 18-30",
      uniqueSellingPoints: "Compelling story",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.platforms).toEqual([]);
      expect(parsed.data.generateImmediately).toBe(false);
      expect(parsed.data.targetAudience).toBe("Gamers aged 18-30");
      expect(parsed.data.downloadUrl).toBeUndefined();
      expect(parsed.data.launchDate).toBeUndefined();
    }
  });

  it("rejects missing name", () => {
    const parsed = createProductSchema.safeParse({
      name: "   ",
      category: "RPG",
      uniqueSellingPoints: "X",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.map((i) => i.message)).toContain("nameRequired");
    }
  });

  it("rejects missing category", () => {
    const parsed = createProductSchema.safeParse({
      name: "X",
      category: "",
      uniqueSellingPoints: "X",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.map((i) => i.message)).toContain("categoryRequired");
    }
  });

  it("rejects missing USP (MVP PRD §13 Q5 contract)", () => {
    const parsed = createProductSchema.safeParse({
      name: "X",
      category: "RPG",
      uniqueSellingPoints: "",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.map((i) => i.message)).toContain("uspRequired");
    }
  });

  it("rejects a non-URL download field", () => {
    const parsed = createProductSchema.safeParse({
      name: "X",
      category: "RPG",
      uniqueSellingPoints: "Y",
      downloadUrl: "not-a-url",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.map((i) => i.message)).toContain("downloadUrlInvalid");
    }
  });

  it("rejects a non-http scheme URL", () => {
    const parsed = createProductSchema.safeParse({
      name: "X",
      category: "RPG",
      uniqueSellingPoints: "Y",
      downloadUrl: "ftp://legacy.example.com/game",
    });
    expect(parsed.success).toBe(false);
  });

  it("coerces empty downloadUrl to undefined (optional)", () => {
    const parsed = createProductSchema.safeParse({
      name: "X",
      category: "RPG",
      targetAudience: "Gamers",
      uniqueSellingPoints: "Y",
      downloadUrl: "",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.downloadUrl).toBeUndefined();
  });

  it("coerces empty launchDate to undefined", () => {
    const parsed = createProductSchema.safeParse({
      name: "X",
      category: "RPG",
      targetAudience: "Gamers",
      uniqueSellingPoints: "Y",
      launchDate: "",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.launchDate).toBeUndefined();
  });

  it("rejects a malformed launchDate", () => {
    const parsed = createProductSchema.safeParse({
      name: "X",
      category: "RPG",
      uniqueSellingPoints: "Y",
      launchDate: "not a date",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.map((i) => i.message)).toContain("launchDateInvalid");
    }
  });

  it("rejects unknown platforms", () => {
    const parsed = createProductSchema.safeParse({
      name: "X",
      category: "RPG",
      uniqueSellingPoints: "Y",
      platforms: ["mobile", "vr-headset"],
    });
    expect(parsed.success).toBe(false);
  });

  it("trims whitespace from all string fields", () => {
    const parsed = createProductSchema.safeParse({
      name: "  Padded Name  ",
      category: "  RPG  ",
      uniqueSellingPoints: "  Compelling  ",
      targetAudience: "  Kids  ",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.name).toBe("Padded Name");
      expect(parsed.data.category).toBe("RPG");
      expect(parsed.data.uniqueSellingPoints).toBe("Compelling");
      expect(parsed.data.targetAudience).toBe("Kids");
    }
  });
});

describe("PRODUCT_PLATFORMS", () => {
  it("is locked to the 4 MVP platforms in a stable order", () => {
    const expected: ProductPlatform[] = ["mobile", "pc", "console", "web3"];
    expect([...PRODUCT_PLATFORMS]).toEqual(expected);
  });
});

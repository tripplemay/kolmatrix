import { describe, expect, it } from "vitest";

import { resolveAuthAwareRoot } from "@/middleware-helpers";

describe("resolveAuthAwareRoot", () => {
  it("returns /<locale>/insight when session present", () => {
    const result = resolveAuthAwareRoot({ locale: "zh", hasSession: true });
    expect(result).toBe("/zh/insight");
  });

  it("returns /<locale>/ when session absent", () => {
    const result = resolveAuthAwareRoot({ locale: "en", hasSession: false });
    expect(result).toBe("/en/");
  });

  it("treats undefined session as anonymous", () => {
    const result = resolveAuthAwareRoot({ locale: "zh", hasSession: undefined });
    expect(result).toBe("/zh/");
  });
});

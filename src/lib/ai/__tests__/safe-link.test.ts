import { describe, expect, it } from "vitest";

import { safeAiActionLink } from "@/lib/ai/safe-link";

const FALLBACK = "/campaigns";

describe("safeAiActionLink — BL-020-F002 (CR-2) white-list", () => {
  describe("white-listed inputs pass through unchanged", () => {
    it.each([
      ["/campaigns"],
      ["/campaigns/cmab12cd30001g8l5h3n2q9rs"],
      ["/campaigns/abc-123"],
      ["/kols/cmqv8r4k7000abc"],
      ["/kols/some-handle"],
      ["/assets"],
      ["/assets?type=email&status=draft"],
      ["/outreach"],
      ["/database"],
      ["/knowledge-base"],
    ])("returns the input unchanged: %s", (input) => {
      expect(safeAiActionLink(input)).toBe(input);
    });
  });

  describe("hostile inputs fall back to /campaigns", () => {
    it("rejects protocol-relative URL (//evil.com/path)", () => {
      expect(safeAiActionLink("//evil.com/path")).toBe(FALLBACK);
    });

    it("rejects javascript: scheme", () => {
      expect(safeAiActionLink("javascript:alert(1)")).toBe(FALLBACK);
    });

    it("rejects data: scheme", () => {
      expect(safeAiActionLink("data:text/html,<script>alert(1)</script>")).toBe(FALLBACK);
    });

    it("rejects absolute http URL", () => {
      expect(safeAiActionLink("http://evil.com/campaigns")).toBe(FALLBACK);
    });

    it("rejects absolute https URL", () => {
      expect(safeAiActionLink("https://evil.com/campaigns")).toBe(FALLBACK);
    });

    it("rejects path traversal (/../admin)", () => {
      expect(safeAiActionLink("/../admin")).toBe(FALLBACK);
    });

    it("rejects path traversal embedded mid-path (/campaigns/../admin)", () => {
      expect(safeAiActionLink("/campaigns/../admin")).toBe(FALLBACK);
    });

    it("rejects relative paths without leading slash", () => {
      expect(safeAiActionLink("campaigns")).toBe(FALLBACK);
    });

    it("rejects unknown but well-formed station-internal paths", () => {
      expect(safeAiActionLink("/admin/users")).toBe(FALLBACK);
      expect(safeAiActionLink("/api/health")).toBe(FALLBACK);
      expect(safeAiActionLink("/internal-tools")).toBe(FALLBACK);
    });
  });

  describe("non-string / empty inputs fall back to /campaigns", () => {
    it("rejects null", () => {
      expect(safeAiActionLink(null)).toBe(FALLBACK);
    });

    it("rejects undefined", () => {
      expect(safeAiActionLink(undefined)).toBe(FALLBACK);
    });

    it("rejects empty string", () => {
      expect(safeAiActionLink("")).toBe(FALLBACK);
    });

    it("rejects numbers", () => {
      expect(safeAiActionLink(42)).toBe(FALLBACK);
    });

    it("rejects objects", () => {
      expect(safeAiActionLink({ url: "/campaigns" })).toBe(FALLBACK);
    });
  });
});

/**
 * BL-083-F004 · KolContactEmails display-logic + wiring guards.
 *
 * The component is an async RSC (getTranslations from next-intl/server),
 * so — matching the kols-detail-fidelity.test.ts convention — the
 * presentation is covered via (a) unit tests on the exported pure helpers
 * and (b) source-level structure guards rather than a full render.
 */
import { readFileSync } from "fs";
import { resolve } from "path";

import { describe, expect, it } from "vitest";

import { coerceEmails, resolveSourceVariant } from "../KolContactEmails";

const ROOT = resolve(__dirname, "..");
function read(relative: string): string {
  return readFileSync(resolve(ROOT, relative), "utf8");
}

describe("BL-083-F004 KolContactEmails — coerceEmails", () => {
  it("returns the non-empty string emails verbatim, trimmed", () => {
    expect(coerceEmails(["  a@b.com ", "c@d.com"])).toEqual([
      "a@b.com",
      "c@d.com",
    ]);
  });

  it("drops blanks and non-string entries from a malformed JSONB value", () => {
    expect(coerceEmails(["a@b.com", "", "  ", 42, null])).toEqual(["a@b.com"]);
  });

  it("returns [] for null / non-array values", () => {
    expect(coerceEmails(null)).toEqual([]);
    expect(coerceEmails(undefined)).toEqual([]);
    expect(coerceEmails("a@b.com")).toEqual([]);
  });
});

describe("BL-083-F004 KolContactEmails — resolveSourceVariant", () => {
  it("maps known email_source values", () => {
    expect(resolveSourceVariant("business-unlock")).toBe("businessUnlock");
    expect(resolveSourceVariant("bio-regex")).toBe("bioRegex");
  });

  it("falls back to 'manual' for unknown / null", () => {
    expect(resolveSourceVariant("manual")).toBe("manual");
    expect(resolveSourceVariant(null)).toBe("manual");
    expect(resolveSourceVariant("something-else")).toBe("manual");
  });
});

describe("BL-083-F004 KolContactEmails — structure guards", () => {
  it("renders the list, source chip, and empty placeholder via i18n", () => {
    const src = read("KolContactEmails.tsx");
    expect(src).toMatch(/data-testid="kol-contact-emails"/);
    expect(src).toMatch(/data-testid="kol-contact-emails-list"/);
    expect(src).toMatch(/data-testid="kol-contact-emails-empty"/);
    // business-unlock chip is the green (emerald) variant.
    expect(src).toMatch(/emerald/);
    // emails are click-to-mail.
    expect(src).toMatch(/mailto:/);
    // copy is fully i18n-driven (no hardcoded English chip labels).
    expect(src).toMatch(/t\("sourceBusinessUnlock"\)/);
    expect(src).toMatch(/t\("sourceBioRegex"\)/);
  });

  it("is wired into the detail page overview column", () => {
    const page = read("page.tsx");
    expect(page).toMatch(/<KolContactEmails\b/);
    expect(page).toMatch(/emails=\{kol\.emails\}/);
    expect(page).toMatch(/emailSource=\{kol\.emailSource\}/);
  });
});

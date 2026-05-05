/**
 * BL-034 F006 · placeholder-guard tests.
 */
import { describe, expect, it } from "vitest";

import {
  AiPlaceholderViolationError,
  validateNoBracketPlaceholders,
} from "@/lib/ai/placeholder-guard";

describe("validateNoBracketPlaceholders", () => {
  it("passes Mustache-only output", () => {
    expect(() =>
      validateNoBracketPlaceholders({
        subject: "Hi {{kol.name}}",
        body: "Promoting {{product.name}}",
      }),
    ).not.toThrow();
  });

  it("throws on bracket placeholder [Creator Name] in subject", () => {
    expect(() =>
      validateNoBracketPlaceholders({
        subject: "Hi [Creator Name]",
        body: "Hello {{kol.name}}",
      }),
    ).toThrow(AiPlaceholderViolationError);
  });

  it("throws on bracket placeholder [Your Name] in body", () => {
    expect(() =>
      validateNoBracketPlaceholders({
        subject: "Promo",
        body: "Reach out to [Your Name] for details",
      }),
    ).toThrow(AiPlaceholderViolationError);
  });

  it("inspects html when subject + body absent", () => {
    expect(() =>
      validateNoBracketPlaceholders({
        html: "<p>Hi [Creator Name]</p>",
      }),
    ).toThrow(/Creator Name/);
  });

  it("returns silently for empty / undefined / null fields", () => {
    expect(() => validateNoBracketPlaceholders({})).not.toThrow();
    expect(() =>
      validateNoBracketPlaceholders({ subject: "", body: undefined, html: null }),
    ).not.toThrow();
  });

  it("does not flag lower-case / sentence-case brackets like [press release]", () => {
    expect(() =>
      validateNoBracketPlaceholders({
        subject: "About [press release]",
        body: "intro [link to product]",
      }),
    ).not.toThrow();
  });
});

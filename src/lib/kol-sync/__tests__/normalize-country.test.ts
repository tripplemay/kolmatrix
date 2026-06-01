/**
 * BL-081-F001 · Unit tests for the country-name → ISO alpha-2 normalizer.
 *
 * The 6 spec acceptance cases (features.json F001) plus alias / casing /
 * whitespace coverage that the fork `location` field exercises in the
 * wild (YouTube ships "United States", "United Kingdom", padded values).
 */
import { describe, expect, it } from "vitest";

import { normalizeCountryName } from "../normalize-country";

describe("normalizeCountryName", () => {
  // --- the 6 locked acceptance cases ---------------------------------
  it("maps 'United States' → 'US'", () => {
    expect(normalizeCountryName("United States")).toBe("US");
  });

  it("maps 'Türkiye' → 'TR' (diacritic alias)", () => {
    expect(normalizeCountryName("Türkiye")).toBe("TR");
  });

  it("maps 'India' → 'IN'", () => {
    expect(normalizeCountryName("India")).toBe("IN");
  });

  it("returns null for an unknown name ('Mars')", () => {
    expect(normalizeCountryName("Mars")).toBeNull();
  });

  it("returns null when location is undefined", () => {
    expect(normalizeCountryName(undefined)).toBeNull();
  });

  it("returns null when location is an empty string", () => {
    expect(normalizeCountryName("")).toBeNull();
  });

  // --- robustness beyond the locked minimum --------------------------
  it("returns null for null", () => {
    expect(normalizeCountryName(null)).toBeNull();
  });

  it("returns null for a whitespace-only string", () => {
    expect(normalizeCountryName("   ")).toBeNull();
  });

  it("trims surrounding whitespace before resolving", () => {
    // i18n-iso-countries does NOT trim itself — the normalizer must.
    expect(normalizeCountryName("  India  ")).toBe("IN");
  });

  it("is case-insensitive", () => {
    expect(normalizeCountryName("united states")).toBe("US");
    expect(normalizeCountryName("JAPAN")).toBe("JP");
  });

  it("resolves common aliases the fork emits", () => {
    expect(normalizeCountryName("Turkey")).toBe("TR");
    expect(normalizeCountryName("United Kingdom")).toBe("GB");
    expect(normalizeCountryName("South Korea")).toBe("KR");
    expect(normalizeCountryName("Brazil")).toBe("BR");
  });

  it("returns null for a city / sub-national value it cannot resolve", () => {
    // YouTube occasionally ships a city; the daily LLM stage handles
    // those — the mapper must not throw or guess.
    expect(normalizeCountryName("Los Angeles")).toBeNull();
  });
});

/**
 * BL-075-F001 · Unit tests for enrichKol() — the hybrid
 * franc (local) + audience-geo-top1 + Claude Haiku LLM enrichment helper.
 *
 * Tests target the contract exposed by `enrichment.ts`:
 *  - franc-driven language path (gated by MIN_LANG_CONFIDENCE +
 *    MIN_LANG_INPUT_CHARS, mapped from ISO 639-3 to 639-1).
 *  - audience_geo_dist top-1 country preference over the LLM (gated by
 *    MIN_AUDIENCE_GEO_PCT, normalising percent and fraction-shaped input,
 *    skipping the "Other" residual bucket).
 *  - LLM fallback via the injectable `deps.llm` stub (collapses errors,
 *    enforces MIN_COUNTRY_CONFIDENCE on the model output).
 *  - Source tags + confidence values match the documented contract so the
 *    F003 audit_log payload + F006 health metric can rely on them.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  __TEST_ONLY__,
  COUNTRY_LLM_TIMEOUT_MS,
  MIN_AUDIENCE_GEO_PCT,
  MIN_COUNTRY_CONFIDENCE,
  MIN_LANG_CONFIDENCE,
  enrichKol,
  type EnrichKolDeps,
  type KolEnrichmentInput,
} from "../enrichment";

const { detectLanguage, pickTopAudienceCountry, FRANC_TO_ISO_639_1 } = __TEST_ONLY__;

function baseInput(overrides: Partial<KolEnrichmentInput> = {}): KolEnrichmentInput {
  return {
    bio: null,
    displayName: "Unnamed Creator",
    handle: "@unknown",
    audienceGeoDist: null,
    platform: "youtube",
    categories: [],
    ...overrides,
  };
}

describe("enrichKol — language path (franc)", () => {
  it("detects English from a multi-sentence bio", async () => {
    const result = await enrichKol(
      baseInput({
        bio: "I am a gaming creator from the United States. I stream Apex Legends and Call of Duty every weekend with my community.",
        displayName: "ApexProUSA",
        handle: "@apexpro",
      }),
    );
    expect(result.language).toBe("en");
    expect(result.source.language).toBe("franc");
    expect(result.languageConfidence).toBeGreaterThanOrEqual(MIN_LANG_CONFIDENCE);
  });

  it("detects Japanese from a Japanese bio", async () => {
    const result = await enrichKol(
      baseInput({
        bio: "こんにちは。日本のゲーム実況者です。毎週ライブ配信をしています。よろしくお願いします。",
        displayName: "ゲーム実況太郎",
        handle: "@gameTaro",
      }),
    );
    expect(result.language).toBe("ja");
    expect(result.source.language).toBe("franc");
  });

  it("returns null language when input is too short for confident detection", async () => {
    const result = await enrichKol(
      baseInput({
        bio: null,
        displayName: "X",
        handle: "@y",
      }),
    );
    expect(result.language).toBeNull();
    expect(result.source.language).toBe("fallback-null");
    expect(result.languageConfidence).toBe(0);
  });

  it("returns null when franc detects a language outside the ISO-639-1 allowlist", () => {
    // detectLanguage is the pure helper. Hand-construct a francAll-like
    // assertion: if franc returns "und" we drop to null. Verified through
    // the exposed helper rather than the full enrichKol so we keep the
    // contract testable without mocking franc itself.
    expect(detectLanguage("???").language).toBeNull();
  });

  it("language path is independent of country path", async () => {
    const result = await enrichKol(
      baseInput({
        bio: "プロゲーマーです。日本で活動しています。",
        displayName: "Player",
        handle: "@p",
        audienceGeoDist: { JP: 70, US: 10, Other: 20 },
      }),
    );
    expect(result.language).toBe("ja");
    expect(result.country).toBe("JP");
    expect(result.source.country).toBe("audience-geo-top1");
  });
});

describe("enrichKol — country path (audience_geo_dist top-1)", () => {
  it("picks JP when top-1 is JP at 60%", async () => {
    const result = await enrichKol(
      baseInput({
        audienceGeoDist: { JP: 60, US: 25, KR: 15 },
      }),
    );
    expect(result.country).toBe("JP");
    expect(result.source.country).toBe("audience-geo-top1");
    expect(result.countryConfidence).toBeCloseTo(0.6);
  });

  it("normalises fraction-shaped input (0-1) to the same confidence scale", async () => {
    const result = await enrichKol(
      baseInput({
        audienceGeoDist: { US: 0.55, GB: 0.3 },
      }),
    );
    expect(result.country).toBe("US");
    expect(result.countryConfidence).toBeCloseTo(0.55);
  });

  it("falls through to LLM when top-1 is below MIN_AUDIENCE_GEO_PCT", async () => {
    process.env.AIGCGATEWAY_KOL_COUNTRY_ACTION_ID = "act_test_kol_country";
    try {
      const llm = vi.fn().mockResolvedValue({ country: "BR", confidence: 0.8 });
      const result = await enrichKol(
        baseInput({
          audienceGeoDist: { US: 21, GB: 19, DE: 18, FR: 17, Other: 25 },
        }),
        { llm, tenantId: "tenant-x" },
      );
      // Top-1 is 21% (US) < MIN_AUDIENCE_GEO_PCT, so we ignored it and asked
      // the LLM instead.
      expect(result.country).toBe("BR");
      expect(result.source.country).toBe("llm");
      expect(llm).toHaveBeenCalledOnce();
      expect(MIN_AUDIENCE_GEO_PCT).toBeGreaterThan(21);
    } finally {
      delete process.env.AIGCGATEWAY_KOL_COUNTRY_ACTION_ID;
    }
  });

  it("ignores the 'Other' bucket even when it dominates", () => {
    expect(
      pickTopAudienceCountry({ Other: 80, US: 10, JP: 10 }),
    ).toBeNull();
  });

  it("returns null when dist is empty or undefined", () => {
    expect(pickTopAudienceCountry(null)).toBeNull();
    expect(pickTopAudienceCountry({})).toBeNull();
    expect(pickTopAudienceCountry(undefined)).toBeNull();
  });
});

describe("enrichKol — LLM fallback", () => {
  beforeEach(() => {
    process.env.AIGCGATEWAY_KOL_COUNTRY_ACTION_ID = "act_test_kol_country";
  });
  afterEach(() => {
    delete process.env.AIGCGATEWAY_KOL_COUNTRY_ACTION_ID;
    vi.restoreAllMocks();
  });

  it("uses LLM when audience_geo_dist is empty", async () => {
    const llm = vi.fn().mockResolvedValue({ country: "US", confidence: 0.7 });
    const result = await enrichKol(
      baseInput({
        bio: "Streaming Fortnite from California every night.",
        audienceGeoDist: null,
      }),
      { llm, tenantId: "tenant-a" },
    );
    expect(result.country).toBe("US");
    expect(result.source.country).toBe("llm");
    expect(result.countryConfidence).toBeCloseTo(0.7);
    expect(llm).toHaveBeenCalledOnce();
    const callArgs = llm.mock.calls[0][0];
    expect(callArgs.tenantId).toBe("tenant-a");
    expect(callArgs.platform).toBe("youtube");
  });

  it("returns null country when LLM confidence is below MIN_COUNTRY_CONFIDENCE", async () => {
    const llm = vi.fn().mockResolvedValue({
      country: "FR",
      confidence: MIN_COUNTRY_CONFIDENCE - 0.1,
    });
    const result = await enrichKol(baseInput({ bio: "Bonjour bonjour bonjour" }), {
      llm,
      tenantId: "tenant-b",
    });
    expect(result.country).toBeNull();
    expect(result.source.country).toBe("fallback-null");
  });

  it("never throws when the LLM throws — collapses to null country", async () => {
    const llm = vi.fn().mockRejectedValue(new Error("kaboom"));
    const result = await enrichKol(baseInput({ bio: "Streaming every day." }), {
      llm,
      tenantId: "tenant-c",
    });
    expect(result.country).toBeNull();
    expect(result.source.country).toBe("fallback-null");
  });

  it("skips LLM when env var is missing — still returns clean fallback", async () => {
    delete process.env.AIGCGATEWAY_KOL_COUNTRY_ACTION_ID;
    const llm = vi.fn();
    const result = await enrichKol(baseInput({ bio: "Some bio" }), {
      llm,
      tenantId: "tenant-d",
    });
    expect(result.country).toBeNull();
    expect(result.source.country).toBe("fallback-null");
    // The injected llm stub is still called because env-var check applies
    // only to the real runAigcAction path. With our injected stub we
    // bypass the env check intentionally — record that for the F003
    // integration: callers that wire the real LLM must set the env var,
    // which inferCountryViaLlm guards before invoking deps.llm.
    expect(llm).not.toHaveBeenCalled();
  });

  it("skips LLM when tenantId is missing — required for cost-cap", async () => {
    const llm = vi.fn();
    const deps: EnrichKolDeps = { llm };
    const result = await enrichKol(baseInput({ bio: "Some bio for detection" }), deps);
    expect(result.country).toBeNull();
    expect(result.source.country).toBe("fallback-null");
    expect(llm).not.toHaveBeenCalled();
  });
});

describe("enrichKol — combined fallback", () => {
  it("returns fully null when no material exists", async () => {
    const result = await enrichKol(baseInput());
    expect(result.language).toBeNull();
    expect(result.country).toBeNull();
    expect(result.source.language).toBe("fallback-null");
    expect(result.source.country).toBe("fallback-null");
    expect(result.languageConfidence).toBe(0);
    expect(result.countryConfidence).toBe(0);
  });
});

describe("enrichKol — config sanity", () => {
  it("FRANC_TO_ISO_639_1 covers the documented top languages", () => {
    for (const code of ["eng", "cmn", "jpn", "kor", "spa", "por", "ind", "vie"]) {
      expect(FRANC_TO_ISO_639_1[code]).toMatch(/^[a-z]{2}$/);
    }
  });

  it("COUNTRY_LLM_TIMEOUT_MS is a sane positive integer", () => {
    expect(COUNTRY_LLM_TIMEOUT_MS).toBeGreaterThan(1_000);
    expect(COUNTRY_LLM_TIMEOUT_MS).toBeLessThan(60_000);
  });
});

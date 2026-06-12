/**
 * BL-075-F001 · KOL country / language enrichment.
 *
 * Provides `enrichKol(input)` — pure async helper consumed by
 *   1. `scripts/kol-sync-daily.ts` (F003) for daily incremental enrichment,
 *   2. `scripts/kol-enrichment-backfill.ts` (F004) for one-shot historical
 *      backfill of the 1397 prod active gaming KOLs.
 *
 * Method per BL-075 §1.3 lock (A1 hybrid):
 *   - language: local `franc` npm pkg (zero LLM cost, zero network); output
 *     ISO 639-3 mapped down to ISO 639-1 via FRANC_TO_ISO_639_1; confidence
 *     gated to >= MIN_LANG_CONFIDENCE so a 4-token random handle does not
 *     poison the column.
 *   - country: `audience_geo_dist` top-1 if >= MIN_AUDIENCE_GEO_PCT (cheap,
 *     audience-grounded); otherwise fall back to a Claude Haiku Action via
 *     `runAigcAction("kol-country-enrichment")`. Any LLM failure path
 *     (missing env, HTTP error, parse error, cost cap hit) collapses to a
 *     silent `null` so the caller can keep moving down the queue.
 *
 * All thresholds live in this file as named exports so the unit tests and
 * a future evaluator audit can pin specific numbers without re-greppering
 * the helper body.
 */
import "dotenv/config";

import { francAll } from "franc";

import {
  AiDailyCostExceededError,
  runAigcAction,
} from "@/lib/aigc/run-action";
import { wrapUserInput } from "@/lib/ai/xml-escape";

/** Minimum probability from `franc` before we accept a language guess.
 *  Below this we return `null` rather than mis-tag the row with "en". */
export const MIN_LANG_CONFIDENCE = 0.5;

/** Minimum chars of input text before we even ask `franc`. Single words
 *  (e.g. just a handle) are not enough signal — `franc` itself returns
 *  "und" under TRIGRAM_THRESHOLD chars anyway, but we double-check to
 *  keep the contract explicit. */
export const MIN_LANG_INPUT_CHARS = 6;

/** audience_geo_dist top-1 must be at least this percent before we
 *  treat it as the country signal. Below this the distribution is too
 *  diffuse to safely pick one country. */
export const MIN_AUDIENCE_GEO_PCT = 40;

/** LLM country confidence threshold. The aigcgateway Action prompt also
 *  enforces this and returns `{ country: null, confidence: 0 }` when
 *  unsure, but we re-check on the client to defend against prompt drift. */
export const MIN_COUNTRY_CONFIDENCE = 0.5;

/** Per-call timeout for the country LLM. Matches BL-068/BL-069 callers. */
export const COUNTRY_LLM_TIMEOUT_MS = 15_000;

export interface KolEnrichmentInput {
  bio?: string | null;
  displayName: string;
  handle: string;
  audienceGeoDist?: Record<string, number> | null;
  platform: string;
  /** Optional — kept on the interface so callers can pass through without
   *  re-shaping, even though enrichment itself does not consume it. */
  categories?: string[];
}

export interface KolEnrichmentResult {
  /** ISO 639-1 (e.g. "en", "ja") or null when below the confidence floor. */
  language: string | null;
  /** ISO 3166-1 alpha-2 (e.g. "US", "JP") or null when neither path resolved. */
  country: string | null;
  /** 0–1, only meaningful when `language` is non-null. */
  languageConfidence: number;
  /** 0–1, only meaningful when `country` is non-null. */
  countryConfidence: number;
  source: {
    language: "franc" | "fallback-null";
    country: "audience-geo-top1" | "llm" | "fallback-null";
  };
}

/** Optional dep-injection for the F003/F004 unit tests so they can stub
 *  the LLM call without touching `runAigcAction` directly. */
export interface EnrichKolDeps {
  llm?: (vars: {
    bio: string;
    display_name: string;
    platform: string;
    audience_geo: string;
    tenantId: string;
  }) => Promise<{ country: string | null; confidence: number } | null>;
  /** Required only for the LLM path — daily-sync passes the current
   *  tenant; backfill passes the KOL's owning tenant. Without it the LLM
   *  branch is skipped (logged as fallback-null). */
  tenantId?: string;
}

/**
 * franc emits ISO 639-3 codes (`eng`, `jpn`, `cmn`, ...). Our `kol.language`
 * column stores ISO 639-1 to stay aligned with the `match` filter sidebar
 * + the rest of next-intl. This map covers the top ~30 languages we expect
 * to see in the gaming KOL pool; anything outside the map returns null so
 * we never write a code the UI cannot render. New entries get added as
 * the audit surfaces them.
 */
const FRANC_TO_ISO_639_1: Record<string, string> = {
  eng: "en",
  cmn: "zh",
  zho: "zh",
  jpn: "ja",
  kor: "ko",
  spa: "es",
  por: "pt",
  fra: "fr",
  deu: "de",
  ita: "it",
  nld: "nl",
  swe: "sv",
  nor: "no",
  dan: "da",
  fin: "fi",
  pol: "pl",
  ces: "cs",
  rus: "ru",
  ukr: "uk",
  tur: "tr",
  ara: "ar",
  heb: "he",
  fas: "fa",
  hin: "hi",
  ben: "bn",
  tha: "th",
  vie: "vi",
  ind: "id",
  msa: "ms",
  zsm: "ms",
  tgl: "tl",
  ell: "el",
  ron: "ro",
  hun: "hu",
};

function detectLanguage(text: string): { language: string | null; confidence: number } {
  if (text.length < MIN_LANG_INPUT_CHARS) {
    return { language: null, confidence: 0 };
  }
  // francAll returns an array of [iso-639-3, probability] sorted desc.
  // Empty array (or "und") means franc could not pin anything.
  const ranked = francAll(text, { minLength: MIN_LANG_INPUT_CHARS });
  const top = ranked[0];
  if (!top || top[0] === "und" || top[1] < MIN_LANG_CONFIDENCE) {
    return { language: null, confidence: 0 };
  }
  const iso6391 = FRANC_TO_ISO_639_1[top[0]];
  if (!iso6391) {
    // Recognised by franc but outside our render-safe allowlist.
    return { language: null, confidence: 0 };
  }
  return { language: iso6391, confidence: top[1] };
}

export function pickTopAudienceCountry(
  dist: Record<string, number> | null | undefined,
): { country: string; confidence: number } | null {
  if (!dist || Object.keys(dist).length === 0) return null;
  let bestKey: string | null = null;
  let bestVal = 0;
  for (const [key, raw] of Object.entries(dist)) {
    // Apify-style "Other" bucket is the residual; never let it be the
    // top-1 even if it dominates because it carries no actionable signal.
    if (key === "Other" || key === "other" || key === "OTHER") continue;
    const value = Number(raw);
    if (!Number.isFinite(value)) continue;
    if (value > bestVal) {
      bestVal = value;
      bestKey = key;
    }
  }
  if (!bestKey) return null;
  // Normalise to percent (0–100) for the threshold compare so callers
  // can pass either percent (`{JP: 60}`) or fraction (`{JP: 0.6}`)
  // shaped distributions and get the same gate behaviour.
  const valuePercent = bestVal <= 1 ? bestVal * 100 : bestVal;
  if (valuePercent < MIN_AUDIENCE_GEO_PCT) return null;
  return {
    country: bestKey.toUpperCase(),
    confidence: Math.min(1, valuePercent / 100),
  };
}

async function inferCountryViaLlm(
  input: KolEnrichmentInput,
  deps: EnrichKolDeps,
): Promise<{ country: string; confidence: number } | null> {
  const actionId = process.env.AIGCGATEWAY_KOL_COUNTRY_ACTION_ID;
  if (!actionId) return null;
  if (!deps.tenantId) return null;

  const variables = {
    bio: wrapUserInput("USER_BIO", input.bio ?? ""),
    display_name: wrapUserInput("USER_DISPLAY_NAME", input.displayName),
    platform: input.platform,
    audience_geo: JSON.stringify(input.audienceGeoDist ?? {}),
  };

  try {
    if (deps.llm) {
      const result = await deps.llm({ ...variables, tenantId: deps.tenantId });
      if (!result || !result.country) return null;
      if (result.confidence < MIN_COUNTRY_CONFIDENCE) return null;
      return {
        country: result.country.toUpperCase(),
        confidence: Math.min(1, Math.max(0, result.confidence)),
      };
    }
    const { output } = await runAigcAction<{
      country?: string | null;
      confidence?: number;
    }>({
      actionId,
      variables,
      tenantId: deps.tenantId,
      actionLabel: "kol_country_enrichment",
      timeoutMs: COUNTRY_LLM_TIMEOUT_MS,
      costBucket: "system",
    });
    if (!output || !output.country) return null;
    const confidence = Number(output.confidence ?? 0);
    if (!Number.isFinite(confidence) || confidence < MIN_COUNTRY_CONFIDENCE) {
      return null;
    }
    return {
      country: String(output.country).toUpperCase(),
      confidence: Math.min(1, Math.max(0, confidence)),
    };
  } catch (err) {
    // Daily cap is informational rather than an error to surface here —
    // the caller (backfill / sync) already meters at the loop level. All
    // other paths (HTTP, timeout, parse) are intentionally swallowed so a
    // flaky LLM call does not stop the rest of the batch. We still log
    // so ops can grep enrichment failures from pm2 logs.
    if (err instanceof AiDailyCostExceededError) {
      console.warn(
        "[enrichKol] tenant=%s daily cost cap hit, skipping LLM country",
        deps.tenantId,
      );
    } else {
      console.warn(
        "[enrichKol] LLM country inference failed: %s",
        (err as Error).message,
      );
    }
    return null;
  }
}

/**
 * Resolve the (language, country) tuple for a single KOL row. Pure async,
 * never throws — every failure collapses to a `null` field with
 * `source: "fallback-null"` so the caller can write the result + audit_log
 * without a try/catch wrapper.
 */
export async function enrichKol(
  input: KolEnrichmentInput,
  deps: EnrichKolDeps = {},
): Promise<KolEnrichmentResult> {
  // 1. Language: concat bio + displayName + handle so we have enough
  //    chars for franc to make a useful guess. Handle alone (5 chars,
  //    one alphanum word) is not enough signal.
  const langText = [input.bio, input.displayName, input.handle]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(" ");
  const lang = detectLanguage(langText);

  // 2. Country: audience_geo_dist top-1 has priority over LLM (it reflects
  //    real audience makeup; LLM is a guess from bio + handle).
  const geoTop = pickTopAudienceCountry(input.audienceGeoDist ?? null);
  if (geoTop) {
    return {
      language: lang.language,
      country: geoTop.country,
      languageConfidence: lang.confidence,
      countryConfidence: geoTop.confidence,
      source: {
        language: lang.language ? "franc" : "fallback-null",
        country: "audience-geo-top1",
      },
    };
  }

  const llm = await inferCountryViaLlm(input, deps);
  if (llm) {
    return {
      language: lang.language,
      country: llm.country,
      languageConfidence: lang.confidence,
      countryConfidence: llm.confidence,
      source: {
        language: lang.language ? "franc" : "fallback-null",
        country: "llm",
      },
    };
  }

  return {
    language: lang.language,
    country: null,
    languageConfidence: lang.confidence,
    countryConfidence: 0,
    source: {
      language: lang.language ? "franc" : "fallback-null",
      country: "fallback-null",
    },
  };
}

export const __TEST_ONLY__ = {
  detectLanguage,
  pickTopAudienceCountry,
  FRANC_TO_ISO_639_1,
};

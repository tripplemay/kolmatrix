/**
 * BL-081-F001 · Country-name → ISO 3166-1 alpha-2 normalizer.
 *
 * The apify-kol fork emits a free-text `location` field on profiles it
 * scrapes (YouTube populates it for ~83% of rows; TikTok / Instagram do
 * not). The Stage 2 mapper (`adapters/apify-kol.ts`) used to hard-code
 * `country: null` and discard that signal, which forced every such KOL
 * into the daily LLM enrichment scan (BL-081 root cause R1). This helper
 * promotes the fork field into the same alpha-2 form the LLM enrichment
 * path already writes to `kol.country_code` (e.g. "JP" / "BR" / "GB"),
 * so YouTube KOLs get a country for free without an LLM call.
 *
 * Contract:
 *   - input  = the fork `location` string (English country name such as
 *              "United States" / "Türkiye"); may be null / undefined /
 *              empty / non-string when the fork omits or malforms it.
 *   - output = ISO 3166-1 alpha-2 code ("US" / "TR") when the name
 *              resolves, otherwise null. Never throws — an unrecognised
 *              value (city name, "Mars", garbage) falls back to null so a
 *              single bad row never blocks the sync batch (spec §5).
 *
 * `i18n-iso-countries` matches case-insensitively but does NOT trim, so
 * we trim first. It also resolves common aliases (Turkey/Türkiye,
 * United Kingdom→GB, "Korea, Republic of"→KR) out of the box, which is
 * why we adopted the library over a hand-rolled map (A1 lock).
 */
import { getAlpha2Code, registerLocale, type LocaleData } from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";

// Register the English locale once at module load (idempotent singleton).
registerLocale(enLocale as LocaleData);

export function normalizeCountryName(
  location: string | null | undefined
): string | null {
  if (typeof location !== "string") return null;
  const trimmed = location.trim();
  if (trimmed.length === 0) return null;
  return getAlpha2Code(trimmed, "en") ?? null;
}

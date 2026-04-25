/**
 * Pure helpers extracted from src/middleware.ts so the routing decision
 * logic can be unit-tested without importing NextAuth (which pulls in
 * `next/server`, breaking Vitest's ESM resolution outside a Next build).
 *
 * src/middleware.ts re-imports from here; runtime behaviour is unchanged.
 */
import { isLocale } from "@/i18n/routing";

export const PROTECTED_PREFIXES = [
  "/dashboard",
  "/discovery",
  "/database",
  "/kols",
  "/campaigns",
  "/emails",
  "/knowledge-base",
  "/analytics",
  "/crm",
  "/roi",
  "/weekly-report",
  "/outreach",
  "/settings",
];

export function stripLocale(pathname: string): string {
  const match = pathname.match(/^\/([a-z]{2})(\/.*)?$/);
  if (match && isLocale(match[1])) {
    return match[2] ?? "/";
  }
  return pathname;
}

export function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/**
 * Locales we actively translate and want to serve to users whose
 * browser advertises them via Accept-Language. ja/ko/es are declared in
 * `routing.locales` so the URLs + manual language switcher still work,
 * but automatic detection should NOT land a user on those paths until
 * the messages are professionally translated (spec BM1-F008 §Q7).
 */
export const DETECTABLE_LOCALES = ["zh", "en"] as const;
export type DetectableLocale = (typeof DETECTABLE_LOCALES)[number];

/**
 * Pick the best match for an Accept-Language header out of the
 * DETECTABLE_LOCALES allowlist. Implements the q-weighted ordering the
 * HTTP spec mandates; ties broken by header order. Anything outside the
 * allowlist — including the raw en-US / zh-TW regional variants — is
 * collapsed to its base tag before matching. Falls back to "en".
 */
export function detectLocaleFromAcceptLanguage(
  header: string | null | undefined
): DetectableLocale {
  if (!header) return "en";
  const entries = header
    .split(",")
    .map((raw, index) => {
      const [langRaw, ...params] = raw.trim().split(";");
      if (!langRaw) return null;
      const tag = langRaw.trim().toLowerCase();
      const base = tag.split("-")[0] ?? tag;
      let q = 1;
      for (const p of params) {
        const match = p.trim().match(/^q=(\d*\.?\d+)$/);
        if (match) {
          const parsed = Number.parseFloat(match[1]!);
          if (Number.isFinite(parsed)) q = parsed;
        }
      }
      return { base, q, index };
    })
    .filter((v): v is { base: string; q: number; index: number } => v !== null);

  entries.sort((a, b) => (b.q - a.q) || (a.index - b.index));

  for (const { base } of entries) {
    if ((DETECTABLE_LOCALES as readonly string[]).includes(base)) {
      return base as DetectableLocale;
    }
  }
  return "en";
}

// BL-064-F006 — file touched intentionally to force a CI run after the
// update-visual-baselines auto-commit (GitHub bot pushes don't trigger
// downstream workflows by default).
/**
 * Pure helpers extracted from src/middleware.ts so the routing decision
 * logic can be unit-tested without importing NextAuth (which pulls in
 * `next/server`, breaking Vitest's ESM resolution outside a Next build).
 *
 * src/middleware.ts re-imports from here; runtime behaviour is unchanged.
 */
import { isLocale } from "@/i18n/routing";

// BL-070-F004 — legacy top-level routes (/dashboard /discovery /database
// /emails /knowledge-base /analytics /weekly-report /outreach) were
// retired in this batch alongside their middleware redirects. They now
// 404 outright, so there is no need to keep them in the protected list
// (404 doesn't reveal auth state).
export const PROTECTED_PREFIXES = [
  "/kols",
  "/campaigns",
  "/crm",
  "/roi",
  "/settings",
  // BL-064-F001 — 4 new top-level IA routes
  "/brief",
  "/match",
  "/reach",
  "/insight",
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
 * IA refactor redirect map (introduced by BL-064-F002, evolved
 * through BL-069 + BL-070-F001/F003).
 *
 * BL-070-F004 emptied the rule list per decision §5 ("BL-070 同批即停
 * redirect"): every legacy top-level route (/dashboard /discovery
 * /database /reports /analytics /weekly-report /knowledge-base/* +
 * /campaigns/new /outreach/*) has been retired and the redirect
 * window is closed — those URLs now 404 outright. The rule structure
 * is preserved (empty array + helper) so future Phase 5 batches can
 * append new redirects without re-wiring middleware.ts.
 */
type IaRedirectRule = {
  pattern: RegExp;
  resolve: (m: RegExpMatchArray) => string;
  /**
   * HTTP status code: 301 permanent or 302 temporary. Falls back to
   * 302 when the rule omits the field (matches the BL-064 default).
   */
  status?: 301 | 302;
};

const IA_REDIRECT_RULES: ReadonlyArray<IaRedirectRule> = [];

export interface IaRedirectResult {
  path: string;
  /** HTTP status code; defaults to 302 when the matched rule omits
   *  `status`. */
  status: 301 | 302;
}

export function resolveIaRefactorRedirect(
  barePath: string,
): IaRedirectResult | null {
  for (const rule of IA_REDIRECT_RULES) {
    const match = barePath.match(rule.pattern);
    if (match) {
      return { path: rule.resolve(match), status: rule.status ?? 302 };
    }
  }
  return null;
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

/**
 * 2026-05-19 landing page · Determines the redirect target for `/`
 * based on whether the request carries an authenticated session.
 *
 * - Authenticated → user's home surface (`/insight`)
 * - Anonymous → marketing landing page (`/{locale}/`)
 *
 * Extracted so middleware.ts can stay short and the decision is
 * trivially unit-testable.
 */
export function resolveAuthAwareRoot(args: {
  locale: string;
  hasSession: boolean | undefined;
}): string {
  return args.hasSession
    ? `/${args.locale}/insight`
    : `/${args.locale}/`;
}

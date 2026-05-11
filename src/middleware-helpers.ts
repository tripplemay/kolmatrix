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
 * BL-064-F002 — Phase 1 IA refactor 302 redirect map.
 *
 * Takes a locale-stripped bare path (e.g. `/dashboard`, `/campaigns/abc`)
 * and returns the new IA bare path (with query string) the user should be
 * redirected to, or `null` if no redirect applies.
 *
 * Order matters in the array below: more specific patterns first
 * (`/campaigns/new` before `/campaigns/:id` before `/campaigns`).
 *
 * Adjudication 2026-05-11 (Planner):
 *   #2 /roi /weekly-report /analytics → /insight  (spec "/reports" 笔误纠正)
 *   #3 /assets /crm /kols/[id] 保留路由（不 redirect），仅 activeNav 映射
 *   #4 /campaigns 列表 → /match?view=campaigns
 *
 * Sub-route inheritance: `/outreach/templates` → `/reach/templates`
 *   (next.js path inheritance via prefix replacement).
 */
type IaRedirectRule = {
  pattern: RegExp;
  resolve: (m: RegExpMatchArray) => string;
};

const IA_REDIRECT_RULES: ReadonlyArray<IaRedirectRule> = [
  // BL-064-F005 fix-round-2 — F002 redirect scope is constrained to
  // *content-equivalent* sources. The new IA shells (F001 A2 embed-old)
  // each embed ONE old page:
  //
  //   /brief    embeds /knowledge-base
  //   /match    embeds /discovery
  //   /reach    embeds /outreach
  //   /insight  embeds /dashboard
  //
  // Routes whose content lives elsewhere (campaigns form / roi cards /
  // weekly-report) cannot be safely 302'd to the new IA — the user
  // would land on a shell that doesn't render what they came for.
  // Those stay as kept deep-link paths until the relevant Phase 2
  // batch wires the content into the new shells:
  //
  //   /campaigns       → kept; BL-066 makes /match honor view=campaigns
  //   /campaigns/new   → kept; BL-069 wires /brief form
  //   /roi             → kept; BL-070 unifies /insight + /roi
  //   /weekly-report   → kept; BL-070 unifies under /insight
  //   /analytics       → kept; BL-070 unifies under /insight
  //
  // Only /campaigns/[id] still redirects to /match?campaignId=:id per
  // adjudication §B — BL-066 will land the matching renderer; until
  // then users see Discovery with the campaignId param visible.
  {
    // Negative lookahead — `/campaigns/new` is a kept path (see comment
    // above); only treat single-segment subpaths as id captures.
    pattern: /^\/campaigns\/(?!new$)([^/?]+)(\?.*)?$/,
    resolve: (m) => `/match?campaignId=${encodeURIComponent(m[1]!)}`,
  },
  // Content-equivalent prefix-rewrite redirects (sub-routes inherit
  // via tail capture).
  { pattern: /^\/dashboard(\/.*)?$/, resolve: (m) => `/insight${m[1] ?? ""}` },
  { pattern: /^\/discovery(\/.*)?$/, resolve: (m) => `/match${m[1] ?? ""}` },
  { pattern: /^\/database(\/.*)?$/, resolve: (m) => `/match${m[1] ?? ""}` },
  { pattern: /^\/knowledge-base(\/.*)?$/, resolve: (m) => `/brief${m[1] ?? ""}` },
  { pattern: /^\/outreach(\/.*)?$/, resolve: (m) => `/reach${m[1] ?? ""}` },
];

export function resolveIaRefactorRedirect(barePath: string): string | null {
  for (const rule of IA_REDIRECT_RULES) {
    const match = barePath.match(rule.pattern);
    if (match) return rule.resolve(match);
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

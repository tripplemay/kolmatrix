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
  /**
   * HTTP status code to return for this redirect.
   *   - 302 (default) — BL-064 default. Temporary; preserves revert
   *     flexibility during the Phase 1 IA transition (per Planner
   *     adjudication §4 #C).
   *   - 301 — permanent. Used by BL-069-F006 for the three
   *     "/knowledge-base*" + "/campaigns/new" rules whose destinations
   *     are content-equivalent and locked by spec (acceptance §F006
   *     "完全 301 redirect"). Per BL-069 fix-round 1 (Reviewer B1).
   *
   * `resolveIaRefactorRedirect` returns `{ path, status }` so the
   * middleware can apply the rule-specific HTTP status without a
   * second lookup. Callers that don't care about the status (eg.
   * vitest unit assertions that only check the destination) can
   * destructure `.path`.
   */
  status?: 301 | 302;
};

const IA_REDIRECT_RULES: ReadonlyArray<IaRedirectRule> = [
  // BL-064-F005 fix-round-2 — F002 redirect scope is constrained to
  // *content-equivalent* sources. BL-070-F001 + F003 promoted /reach
  // and (in F003) /insight from embed-old shells to real routes with
  // their own content; the redirect rules below match the migrated
  // pages:
  //
  //   /brief    → real route (BL-069-F003)
  //   /match    → real route (BL-065)
  //   /reach    → real route (BL-070-F001, was embed-old /outreach)
  //   /insight  → real route (BL-070-F003, was embed-old /dashboard)
  //
  // Routes whose content lives elsewhere (campaigns form / roi cards /
  // weekly-report) cannot be safely 302'd to the new IA — the user
  // would land on a shell that doesn't render what they came for.
  // Those stay as kept deep-link paths until the relevant Phase 2
  // batch wires the content into the new shells:
  //
  //   /campaigns       → kept; BL-066 makes /match honor view=campaigns
  //   /campaigns/new   → kept; BL-069 wires /brief form
  //   /campaigns/[id]  → kept (BL-066-F008 removed the prior 302→
  //                     /match?campaignId=:id rule — F002 wired the
  //                     three-section renderer back on, F008 closes
  //                     the redirect loop so users actually reach it.
  //                     See ia-refactor-redirects.spec.ts KEPT_PATHS.)
  //   /roi             → kept; BL-070 unifies /insight + /roi
  //   /weekly-report   → kept; BL-070 unifies under /insight
  //   /analytics       → kept; BL-070 unifies under /insight
  //
  // BL-070-F004 will git rm both the old route directories and these
  // rules outright (same-batch cleanup per spec §4 decision #5 —
  // legacy URLs return 404 once the redirect window closes).
  { pattern: /^\/dashboard$/, resolve: () => "/insight" },
  { pattern: /^\/discovery$/, resolve: () => "/match" },
  { pattern: /^\/database$/, resolve: () => "/match" },
  // BL-069-F006 — KB now redirects with the `?tab=products` query
  // string so the brand-new /brief layout (BriefAiInputBar +
  // CampaignForm) doesn't hijack users who bookmarked the legacy KB.
  // Order matters: the `[productId]` deep-link rule must match before
  // the bare `/knowledge-base` rule (more specific first), and we
  // restrict the id segment to a single path piece so multi-segment
  // sub-paths (/knowledge-base/foo/bar) still fall through to null.
  //
  // BL-069 fix-round 1 (Reviewer B1): all three BL-069 rules carry
  // status=301 because spec §F006 acceptance #1 wrote "完全 301
  // redirect" — destination is content-equivalent + permanent (the
  // legacy routes are being retired by BL-070 二次清理).
  {
    pattern: /^\/knowledge-base\/([^/]+)$/,
    resolve: (m) =>
      `/brief?tab=products&productId=${encodeURIComponent(m[1] ?? "")}`,
    status: 301,
  },
  {
    pattern: /^\/knowledge-base$/,
    resolve: () => "/brief?tab=products",
    status: 301,
  },
  // BL-069-F006 — /campaigns/new now lands on the AI-driven /brief
  // form. The `action=new` query hint is reserved for a future
  // "skip-AI / open empty form directly" affordance (Phase 5 candidate);
  // the brief page renders the same CampaignForm regardless today.
  {
    pattern: /^\/campaigns\/new$/,
    resolve: () => "/brief?action=new",
    status: 301,
  },
  // BL-070-F001 — /outreach (+ all sub-paths: templates / tracking /
  // suppression) now lives under /reach. Spec §F001 acceptance #3
  // requires 301 permanent + sub-path inheritance via prefix swap
  // (per BL-069 v0.9.22 #14 IaRedirectRule status field pattern).
  // F004 will git rm this rule outright; the legacy URL then 404s
  // (same-batch cleanup per spec §4 decision #5).
  {
    pattern: /^\/outreach(\/.*)?$/,
    resolve: (m) => `/reach${m[1] ?? ""}`,
    status: 301,
  },
];

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

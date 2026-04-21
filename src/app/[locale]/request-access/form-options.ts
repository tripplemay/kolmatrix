/**
 * Canonical enum tuples for the /request-access intake form.
 *
 * Lives in its own module (NOT in actions.ts) because Next.js's "use
 * server" directive restricts exports to async functions; plain
 * constant exports cause an `i.map is not a function` prerender error
 * when a Client Component tries to iterate them (build fails on
 * /[locale]/request-access/page).
 */
export const ROLE_OPTIONS = [
  "marketing-manager",
  "influencer-relations",
  "growth-lead",
  "founder",
  "agency-pm",
  "other",
] as const;

export const CAMPAIGNS_OPTIONS = ["0-5", "6-20", "21-50", "50+"] as const;

export type RoleOption = (typeof ROLE_OPTIONS)[number];
export type CampaignsOption = (typeof CAMPAIGNS_OPTIONS)[number];

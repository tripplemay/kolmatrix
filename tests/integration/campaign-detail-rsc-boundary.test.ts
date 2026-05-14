/**
 * Regression: BM2-F011-001 fixing-round / RSC boundary on campaign
 * detail. The first regenerate-baselines retry (run 24952740601)
 * captured 11/12 baselines but campaign-detail timed out; the
 * follow-up retry (24952837137) revealed the underlying error:
 *
 *   "Functions cannot be passed directly to Client Components
 *    unless you explicitly expose it by marking it with use-server.
 *    Or maybe you meant to call this function rather than return it."
 *
 * The Server Component at src/app/[locale]/(app)/campaigns/[id]/page.tsx
 * was passing a function transitionTo prop across the RSC -> Client
 * boundary into CampaignStatusController. The fix precomputes the
 * localised label for every reachable status as a Record string-to-
 * string (same shape as the existing statusLabels and errorLabels).
 *
 * Static-source guard so the regression cannot silently land again.
 * Both typecheck and lint pass for the function-typed shape because
 * the Client Component declares the function in its prop type, so
 * only the runtime route render surfaces the bug. Pattern note: the
 * same class of bug was fixed at the outreach boundary in commit
 * fd14b6f (drop function-typed labels across RSC -> client boundary).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const PAGE = resolve(
  process.cwd(),
  "src/app/[locale]/(app)/campaigns/[id]/page.tsx"
);
const CONTROLLER = resolve(
  process.cwd(),
  "src/app/[locale]/(app)/campaigns/[id]/CampaignStatusController.tsx"
);

describe("Campaign detail RSC -> Client boundary (BM2-F011-001)", () => {
  // BL-066-F002: page.tsx no longer mounts CampaignStatusController
  // (3-section AI-native layout — controller file kept with
  // @deprecated_by_BL-066 marker for BL-070 atomic delete). The
  // original page.tsx-side guard is folded into the file-level guard
  // below; once BL-070 deletes the controller, this whole suite goes
  // away.
  it("page.tsx must not pass a function as transitionTo (RSC violation)", () => {
    const src = readFileSync(PAGE, "utf-8");
    expect(src).not.toMatch(/transitionTo\s*:\s*\(\s*next\s*:\s*string\s*\)\s*=>/);
  });

  it("CampaignStatusController accepts a Record<string,string>, not a function", () => {
    const src = readFileSync(CONTROLLER, "utf-8");
    expect(src).not.toMatch(/transitionTo\s*:\s*\(\s*next\s*:\s*string\s*\)\s*=>\s*string/);
    expect(src).toMatch(/transitionTo\s*:\s*Record<string,\s*string>/);
    expect(src).toMatch(/labels\.transitionTo\[next\]/);
    expect(src).not.toMatch(/labels\.transitionTo\(next\)/);
  });
});

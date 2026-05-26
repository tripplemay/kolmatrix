/**
 * BL-070-F011 — fidelity guard for the SSR Suspense-stream refactor.
 *
 * Acceptance (spec §F011): /match keeps runMatchSearch + campaign
 * lookup on the critical path while loadDatabaseStats + savedSearch
 * findMany stream behind Suspense; /reach keeps runEmailQuickStats +
 * loadOutreachComposerData on the critical path while
 * runSendingPerformance30d / runTopTemplates / runRecentReplies /
 * runRecentlySent stream behind Suspense.
 *
 * Source-grep style; mirrors the other f00X-fidelity tests.
 */
import { readFileSync } from "fs";
import { resolve } from "path";

import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("BL-070-F011 SSR Suspense stream", () => {
  describe("/match — KPI strip + saved-search stream behind Suspense", () => {
    const match = read("src/app/[locale]/(app)/match/page.tsx");

    it("runMatchSearch + campaign lookup remain on the critical path", () => {
      // Promise.all retains the awaited members. BL-073-F006 added the
      // data-coverage snapshot to the tuple (parallel with the search
      // so it does not extend LCP). BL-075-F005 added the fill-rate
      // snapshot for the new "Coverage: N%" sidebar hint and dropped
      // the `searchResultRaw` post-filter wrapper (the page now just
      // uses `searchResult` directly because the hint communicates the
      // partial coverage instead of empty-out the result).
      expect(match).toMatch(
        /const \[searchResult, campaign, coverage, fillRates\] = await Promise\.all\(\[\s*runMatchSearch/,
      );
      // Coverage snapshot must enter the tuple via loadMatchDataCoverage.
      expect(match).toMatch(/loadMatchDataCoverage\(tenantId\)/);
      // BL-075-F005: fill-rate snapshot must enter the tuple via
      // loadMatchDataFillRates so the sidebar hint stays in sync with
      // the actual pool fill rate.
      expect(match).toMatch(/loadMatchDataFillRates\(tenantId\)/);
    });

    it("loadDatabaseStats has been moved off the page-level await chain", () => {
      // The KPI strip's data fetch only happens inside QuickStatsAsync.
      expect(match).not.toMatch(/loadDatabaseStats\(tenantId\),/);
      expect(match).toMatch(
        /async function QuickStatsAsync[\s\S]*?loadDatabaseStats\(tenantId\)/,
      );
    });

    it("savedSearch findMany only resolves inside SavedSearchAsync", () => {
      expect(match).toMatch(
        /async function SavedSearchAsync[\s\S]*?tx\.savedSearch\.findMany\(/,
      );
      // The page-level Promise.all no longer awaits savedSearches.
      expect(match).not.toMatch(/savedSearches, campaign\] = await Promise\.all/);
    });

    it("the QuickStats + SaveSearchControls render inside <Suspense fallback={…}>", () => {
      expect(match).toMatch(
        /<Suspense fallback=\{<QuickStatsSkeleton/,
      );
      expect(match).toMatch(
        /<Suspense fallback=\{<SaveSearchControlsSkeleton/,
      );
    });

    it("skeleton fallbacks reuse the glass-panel animate-pulse pattern (CLS reservation)", () => {
      expect(match).toMatch(/QuickStatsSkeleton[\s\S]*?glass-panel[\s\S]*?animate-pulse/);
      expect(match).toMatch(
        /SaveSearchControlsSkeleton[\s\S]*?glass-panel[\s\S]*?animate-pulse/,
      );
    });
  });

  describe("/reach — 4 auxiliary surfaces stream behind Suspense", () => {
    const reach = read("src/app/[locale]/(app)/reach/page.tsx");

    it("runEmailQuickStats + loadOutreachComposerData remain on the critical path", () => {
      expect(reach).toMatch(
        /const \[stats, composerData\] = await Promise\.all\(\[\s*runEmailQuickStats/,
      );
      expect(reach).toMatch(/loadOutreachComposerData\(tenantId/);
    });

    it("the 4 deferred analytics calls no longer appear in the top-level Promise.all", () => {
      // Page-level Promise.all is exactly 2 entries; analytics calls are
      // resolved inside the async children.
      const topLevelAwait = reach.match(
        /await Promise\.all\(\[[\s\S]*?\]\);/,
      )?.[0] ?? "";
      expect(topLevelAwait).not.toMatch(/runSendingPerformance30d/);
      expect(topLevelAwait).not.toMatch(/runTopTemplates/);
      expect(topLevelAwait).not.toMatch(/runRecentReplies/);
      expect(topLevelAwait).not.toMatch(/runRecentlySent/);
    });

    it("each deferred call resolves inside its own async sub-component", () => {
      expect(reach).toMatch(
        /async function SendingPerformanceAsync[\s\S]*?runSendingPerformance30d/,
      );
      expect(reach).toMatch(
        /async function TopTemplatesAsync[\s\S]*?runTopTemplates/,
      );
      expect(reach).toMatch(
        /async function RecentRepliesAsync[\s\S]*?runRecentReplies/,
      );
      expect(reach).toMatch(
        /async function RecentlySentAsync[\s\S]*?runRecentlySent/,
      );
    });

    it("each deferred surface mounts under <Suspense fallback={…}>", () => {
      expect(reach).toMatch(/<Suspense fallback=\{<SendingPerformanceSkeleton/);
      expect(reach).toMatch(/<Suspense fallback=\{<BottomCardSkeleton/);
      expect(reach).toMatch(/<Suspense fallback=\{<RecentlySentSkeleton/);
    });

    it("skeleton fallbacks reuse the glass-panel animate-pulse pattern (CLS reservation)", () => {
      for (const name of [
        "SendingPerformanceSkeleton",
        "BottomCardSkeleton",
        "RecentlySentSkeleton",
      ]) {
        const re = new RegExp(
          `function ${name}[\\s\\S]*?glass-panel[\\s\\S]*?animate-pulse`,
        );
        expect(reach, `${name} skeleton missing glass-panel animate-pulse`).toMatch(re);
      }
    });
  });

  describe("/brief and /insight remain untouched by F011", () => {
    it("/brief page does not introduce Suspense (per spec §F011)", () => {
      const brief = read("src/app/[locale]/(app)/brief/page.tsx");
      expect(brief).not.toMatch(/<Suspense\b/);
    });

    it("/insight page does not introduce Suspense (per spec §F011)", () => {
      const insight = read("src/app/[locale]/(app)/insight/page.tsx");
      expect(insight).not.toMatch(/<Suspense\b/);
    });
  });
});

/**
 * BL-065-F002 · Source-level fidelity guards for the /match merged
 * filter + search + chip surfaces.
 *
 * These tests don't render — they static-grep the match folder and
 * fail if a spec-required element regresses. The async-server-
 * component nature of MatchFilterSidebar / MatchActiveFilters /
 * MatchTableSearch / MatchSearchBar (await getTranslations + cookies())
 * makes them awkward to render under vitest+jsdom, but the
 * acceptance is structural (right testids, right dimensions, right
 * dropped duplicates), and structural assertions translate cleanly
 * into source greps. Same pattern as discovery-fidelity.test.ts
 * (MVP-vf-F002).
 */
import { readFileSync } from "fs";
import { resolve } from "path";

import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "..");

function read(relative: string): string {
  return readFileSync(resolve(ROOT, relative), "utf8");
}

describe("/match merged FilterSidebar (BL-065-F002)", () => {
  it("renders all 7 relationship-status pills from /database (decision-merged)", () => {
    const sidebar = read("MatchFilterSidebar.tsx");
    // The STATUS_PILLS const is the only place that bakes in the
    // pill set; if BL-068 ever adds a status the const update keeps
    // this assertion honest.
    expect(sidebar).toMatch(/STATUS_PILLS\s*=\s*\["all",\s*\.\.\.RELATIONSHIP_STATUSES\]/);
    expect(sidebar).toMatch(/data-testid={`match-status-pill-\$\{s\}`}/);
    expect(sidebar).toMatch(/data-testid="match-status-pills"/);
  });

  it("surfaces the BM1 /database tier dropdown inside the Advanced section", () => {
    const sidebar = read("MatchFilterSidebar.tsx");
    expect(sidebar).toMatch(/TIER_OPTIONS\s*=\s*\["high",\s*"medium",\s*"low",\s*"unrated"\]/);
    expect(sidebar).toMatch(/name="tiers"/);
    expect(sidebar).toMatch(/data-testid={`match-tier-option-\$\{tier\}`}/);
  });

  it("drops the /database 'Game' duplicate (which previously bound to categories twice)", () => {
    const sidebar = read("MatchFilterSidebar.tsx");
    // The legacy DatabaseFilterBar had `t("game")` + a 2nd Select bound
    // to `name="categories"` — the merge spec calls that a duplicate.
    // Match's sidebar must surface Category exactly once.
    const categoryMatches = sidebar.match(/name="categories"/g) ?? [];
    expect(categoryMatches.length).toBe(1);
    // Sanity: no leftover `game` translation key reference.
    expect(sidebar).not.toMatch(/tDbFilters\("game"\)/);
  });

  it("preserves the AdvancedToggleCookie persistence under a /match-scoped cookie name", () => {
    const sidebar = read("MatchFilterSidebar.tsx");
    expect(sidebar).toMatch(/kolm_match_advanced/);
    expect(sidebar).toMatch(/<AdvancedToggleCookie /);
  });

  it("keeps every 11 BM1 /discovery advanced dimensions inside the Advanced section", () => {
    const sidebar = read("MatchFilterSidebar.tsx");
    // platforms / languages / engagement / avgViews / uploads / lastUpload
    // monetization / brandSafety / knownCollabs / tags
    // channelAge / uploadFrequency / regionGroup / includeNonGaming
    for (const name of [
      "platforms",
      "languages",
      "engagementMin",
      "avgViewsMin",
      "uploadsPerMonthMin",
      "lastUpload",
      "monetization",
      "brandSafety",
      "knownCollabs",
      "tags",
      "channelAge",
      "uploadFrequency",
      "regionGroup",
      "includeNonGaming",
    ]) {
      expect(
        sidebar.includes(`name="${name}"`),
        `${name} chip/input is missing from MatchFilterSidebar`,
      ).toBe(true);
    }
  });
});

describe("/match active-filter chip strip (BL-065-F002)", () => {
  it("surfaces relationshipStatus chips (BM1 /database addition)", () => {
    const af = read("MatchActiveFilters.tsx");
    expect(af).toMatch(/relationshipStatus-/);
    expect(af).toMatch(/relationshipStatuses\.filter/);
  });

  it("surfaces tier chips (BM1 /database addition)", () => {
    const af = read("MatchActiveFilters.tsx");
    expect(af).toMatch(/`tier-\$\{tier\}`/);
    expect(af).toMatch(/tiers \?\? \[\]/);
  });

  it("BL-107-F002/M7 — the fake `?ai=` AI chip + fallback banner are removed", () => {
    const af = read("MatchActiveFilters.tsx");
    // Target the actual render code (not prose) so the guard is precise.
    expect(af).not.toMatch(/key:\s*"aiQuery"/);
    expect(af).not.toMatch(/t\("aiPrefix"\)/);
    expect(af).not.toMatch(/t\("aiFallbackBanner"\)/);
    expect(af).not.toMatch(/data-testid="match-ai-fallback-banner"/);
  });

  it("preserves every Discovery ActiveFilters chip dimension (no regressions)", () => {
    const af = read("MatchActiveFilters.tsx");
    for (const key of [
      // BL-107-F002/M7 — "aiQuery" chip removed (fake AI search retired).
      "search",
      "followers",
      "region-",
      "category-",
      "platform-",
      "languages",
      "engagement",
      "avgViews",
      "uploadsPerMonthMin",
      "lastUpload",
      "monetization-",
      "brandSafety-",
      "knownCollabs",
      "tags",
      "channelAge-",
      "uploadFrequency-",
      "regionGroup-",
      "includeNonGaming",
    ]) {
      expect(
        af.includes(key),
        `chip key "${key}" missing in MatchActiveFilters`,
      ).toBe(true);
    }
  });
});

describe("/match search surfaces (BL-065-F002)", () => {
  it("MatchSearchBar drops the BL-044 AI-chips section (BL-068 territory)", () => {
    const sb = read("MatchSearchBar.tsx");
    expect(sb).toMatch(/data-testid="match-search-bar"/);
    expect(sb).toMatch(/data-testid="match-search-platform-select"/);
    expect(sb).toMatch(/data-testid="match-search-main-input"/);
    // AI chip data-testids from BM1 /discovery must NOT have leaked into
    // /match — semantic free-text search is out of BL-065 scope.
    expect(sb).not.toMatch(/data-testid="ai-chip-/);
    expect(sb).not.toMatch(/discovery-ai-chips/);
  });

  it("MatchSearchBar carries over the view + campaignId signals", () => {
    const sb = read("MatchSearchBar.tsx");
    expect(sb).toMatch(/if \(extras\.view === "table"\)/);
    expect(sb).toMatch(/if \(extras\.campaignId\)/);
  });

  it("MatchTableSearch only mounts inside the table view and stays in it on submit", () => {
    const ts = read("MatchTableSearch.tsx");
    expect(ts).toMatch(/data-testid="match-table-search"/);
    expect(ts).toMatch(/data-testid="match-table-search-input"/);
    // The hidden `view=table` input is what keeps the user in table
    // view after applying the inline search.
    expect(ts).toMatch(/<input type="hidden" name="view" value="table"/);
  });

  it("page.tsx mounts MatchTableSearch only in table view with rows present", () => {
    const page = read("page.tsx");
    expect(page).toMatch(/view === "table" && searchResult\.items\.length > 0/);
    expect(page).toMatch(/<MatchTableSearch /);
  });

  it("page.tsx wires SaveSearchControls + MatchActiveFilters + MatchSearchBar", () => {
    const page = read("page.tsx");
    // \b allows newline / space / attribute char after the tag name.
    expect(page).toMatch(/<SaveSearchControls\b/);
    expect(page).toMatch(/<MatchActiveFilters\b/);
    expect(page).toMatch(/<MatchSearchBar\b/);
    expect(page).toMatch(/<MatchFilterSidebar\b/);
    // The legacy F001 FilterSidebar import must be gone after F002.
    expect(page).not.toMatch(
      /from "@\/app\/\[locale\]\/\(app\)\/discovery\/FilterSidebar"/,
    );
  });
});

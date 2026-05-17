/**
 * MVP-vf-F007 · Visual baseline collection contract.
 *
 * Locks the post-F001 baseline shape in:
 *   - tests/screenshots/baseline/*.png are all git-tracked (no stray
 *     local-only PNGs that would diff in CI)
 *   - the 15 expected pages are present (dashboard.png regenerated
 *     2026-05-01 with F001 WorkflowSteps + CPI + ROI inserts)
 *   - the visual-regression spec covers each baseline with a
 *     toHaveScreenshot() call so a missing test can't silently
 *     orphan a baseline file
 *
 * If you add a new visual page, expand EXPECTED_BASELINES + add the
 * matching toHaveScreenshot() in visual-regression.spec.ts.
 */
import { execFileSync } from "child_process";
import { readdirSync, readFileSync } from "fs";
import { resolve } from "path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "../..");

// BL-026-F002/F004/F005 Reviewer follow-up: 5 new baselines added
// for the post-redesign /assets shell + /outreach composer (per
// spec §S1.6). en-assets-wizard-step1.png stays deleted.
//
// BL-055-F007 Reviewer follow-up: 5 hotfix baselines added. The
// last three are intentionally locator-scoped (sidebar = 240px wide,
// outreach tabs strip = 976px wide) so they capture only the chrome
// the hotfix touches; full-page would re-trip on every other-page
// drift. We track the expected width per baseline so the canonical-
// width guard still catches accidental viewport changes on the
// 1280-wide screenshots without erroring on the deliberate locator
// crops.
const EXPECTED_BASELINES: ReadonlyArray<{ name: string; width: number }> = [
  { name: "dashboard.png", width: 1280 },
  { name: "en-assets-drawer-open.png", width: 1280 },
  { name: "en-assets-empty-system-seed.png", width: 1280 },
  { name: "en-assets-filter-dropdown.png", width: 1280 },
  { name: "en-assets.png", width: 1280 },
  { name: "en-campaign-detail.png", width: 1280 },
  { name: "en-campaigns.png", width: 1280 },
  { name: "en-crm.png", width: 1280 },
  // BL-065-F006 — en-database.png + en-discovery.png removed alongside
  // the deleted /database + /discovery routes. BL-066-F009 lands the
  // new en-match.png baseline (see entry below).
  { name: "en-knowledge-base-bottom.png", width: 1280 },
  { name: "en-knowledge-base.png", width: 1280 },
  { name: "en-kols-detail.png", width: 1280 },
  { name: "en-login.png", width: 1280 },
  // BL-066-F009 — en-match.png lands the unified workbench baseline.
  // Width = 1332 (not 1280) because /match page renders a horizontal-
  // scroll grid that extends the body beyond the viewport; fullPage
  // captures the actual scrollWidth.
  { name: "en-match.png", width: 1332 },
  // BL-068-F007 — /match `?campaignId` mode mounts MatchRefineBar in the
  // right column. Width = 1280 (not 1332) because mounting the AI
  // sidebar in that mode adds a 3rd column to the grid which absorbs
  // the horizontal slack — page now fits within the 1280 viewport, so
  // fullPage capture matches the configured viewport width.
  { name: "en-match-with-campaign.png", width: 1280 },
  { name: "en-network-status-online.png", width: 1280 },
  { name: "en-outreach-templates-badge.png", width: 976 },
  { name: "en-outreach-templates.png", width: 1280 },
  { name: "en-outreach.png", width: 1280 },
  { name: "en-request-access.png", width: 1280 },
  { name: "en-roi.png", width: 1280 },
  { name: "en-sidebar-logo.png", width: 240 },
  { name: "en-weekly-report.png", width: 1280 },
  { name: "zh-login.png", width: 1280 },
  { name: "zh-sidebar-logo.png", width: 240 },
];

const EXPECTED_NAMES: ReadonlyArray<string> = EXPECTED_BASELINES.map((b) => b.name);

function gitTrackedBaselines(): string[] {
  const out = execFileSync("git", ["ls-files", "tests/screenshots/baseline/"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  return out
    .split("\n")
    .filter(Boolean)
    .map((p) => p.replace(/^tests\/screenshots\/baseline\//, ""))
    .filter((p) => p.endsWith(".png"))
    .sort();
}

function baselineWidths(): Array<{ name: string; width: number }> {
  return readdirSync(resolve(REPO_ROOT, "tests/screenshots/baseline"))
    .filter((name) => name.endsWith(".png"))
    .sort()
    .map((name) => {
      const png = readFileSync(resolve(REPO_ROOT, "tests/screenshots/baseline", name));
      // PNG IHDR stores width as a 4-byte big-endian int at offset 16.
      if (png.length < 24) throw new Error(`invalid png: ${name}`);
      return { name, width: png.readUInt32BE(16) };
    });
}

describe("visual baseline collection (MVP-vf-F007)", () => {
  it(`git tracks exactly the ${EXPECTED_BASELINES.length} baseline PNGs the spec covers`, () => {
    expect(gitTrackedBaselines()).toEqual([...EXPECTED_NAMES].sort());
  });

  it("every git-tracked baseline has a matching toHaveScreenshot() call", () => {
    const spec = readFileSync(resolve(REPO_ROOT, "tests/e2e/visual-regression.spec.ts"), "utf8");
    for (const baseline of EXPECTED_NAMES) {
      expect(
        spec,
        `expected toHaveScreenshot("${baseline}") in visual-regression.spec.ts`
      ).toContain(`toHaveScreenshot("${baseline}"`);
    }
  });

  it("each baseline matches its declared canonical Playwright width", () => {
    const expected = [...EXPECTED_BASELINES].sort((a, b) => a.name.localeCompare(b.name));
    expect(baselineWidths()).toEqual(expected);
  });
});

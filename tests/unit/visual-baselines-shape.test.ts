/**
 * MVP-vf-F007 · Visual baseline collection contract.
 *
 * Locks the post-hotfix baseline shape in:
 *   - tests/screenshots/baseline/*.png are all git-tracked (no stray
 *     local-only PNGs that would diff in CI)
 *   - the 15 expected pages are present (the 12 BM1+BM2 set plus
 *     en-kols-detail, en-outreach-templates, and zh-login)
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

const EXPECTED_BASELINES = [
  "dashboard.png",
  "en-campaign-detail.png",
  "en-campaigns.png",
  "en-crm.png",
  "en-database.png",
  "en-discovery.png",
  "en-knowledge-base.png",
  "en-kols-detail.png",
  "en-login.png",
  "en-outreach-templates.png",
  "en-outreach.png",
  "en-request-access.png",
  "en-roi.png",
  "en-weekly-report.png",
  "zh-login.png",
] as const;

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
  it("git tracks exactly the 15 baseline PNGs the spec covers", () => {
    expect(gitTrackedBaselines()).toEqual([...EXPECTED_BASELINES].sort());
  });

  it("every git-tracked baseline has a matching toHaveScreenshot() call", () => {
    const spec = readFileSync(resolve(REPO_ROOT, "tests/e2e/visual-regression.spec.ts"), "utf8");
    for (const baseline of EXPECTED_BASELINES) {
      expect(
        spec,
        `expected toHaveScreenshot("${baseline}") in visual-regression.spec.ts`
      ).toContain(`toHaveScreenshot("${baseline}"`);
    }
  });

  it("keeps every baseline on the canonical 1280px Playwright width", () => {
    expect(baselineWidths()).toEqual(
      EXPECTED_BASELINES.map((name) => ({ name, width: 1280 })).sort((a, b) =>
        a.name.localeCompare(b.name)
      )
    );
  });
});

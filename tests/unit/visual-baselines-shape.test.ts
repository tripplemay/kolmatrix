/**
 * MVP-vf-F007 · Visual baseline collection contract.
 *
 * Locks the post-hotfix baseline shape in:
 *   - tests/screenshots/baseline/*.png are all git-tracked (no stray
 *     local-only PNGs that would diff in CI)
 *   - the 13 expected pages are present (the 12 BM1+BM2 set plus the
 *     new en-kols-detail introduced by F006)
 *   - the visual-regression spec covers each baseline with a
 *     toHaveScreenshot() call so a missing test can't silently
 *     orphan a baseline file
 *
 * If you add a new visual page, expand EXPECTED_BASELINES + add the
 * matching toHaveScreenshot() in visual-regression.spec.ts.
 */
import { execFileSync } from "child_process";
import { readFileSync } from "fs";
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
  "en-outreach.png",
  "en-request-access.png",
  "en-roi.png",
  "en-weekly-report.png",
] as const;

function gitTrackedBaselines(): string[] {
  const out = execFileSync(
    "git",
    ["ls-files", "tests/screenshots/baseline/"],
    { cwd: REPO_ROOT, encoding: "utf8" }
  );
  return out
    .split("\n")
    .filter(Boolean)
    .map((p) => p.replace(/^tests\/screenshots\/baseline\//, ""))
    .filter((p) => p.endsWith(".png"))
    .sort();
}

describe("visual baseline collection (MVP-vf-F007)", () => {
  it("git tracks exactly the 13 baseline PNGs the spec covers", () => {
    expect(gitTrackedBaselines()).toEqual([...EXPECTED_BASELINES].sort());
  });

  it("every git-tracked baseline has a matching toHaveScreenshot() call", () => {
    const spec = readFileSync(
      resolve(REPO_ROOT, "tests/e2e/visual-regression.spec.ts"),
      "utf8"
    );
    for (const baseline of EXPECTED_BASELINES) {
      expect(
        spec,
        `expected toHaveScreenshot("${baseline}") in visual-regression.spec.ts`
      ).toContain(`toHaveScreenshot("${baseline}"`);
    }
  });
});

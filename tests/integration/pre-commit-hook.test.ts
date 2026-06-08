/**
 * BL-027-F004 · Pre-commit hook — network-free cases.
 *
 * Verifies the hook in framework/templates/pre-commit-hook.sh for the paths
 * that do NOT need the Google Fonts fetch:
 *   - state-machine commits / docs short-circuit section 2 (no regen run)
 *   - 铁律 #11 JSON validation still fires (section 1)
 *   - a regen-script failure surfaces as an explicit rejection
 *
 * BL-094-F001: the two cases that run the real regenerate script against
 * Google Fonts (woff2 matches / woff2 stale-not-staged) moved to
 * pre-commit-hook.network.test.ts — they are external-network-dependent and
 * run in the isolated `test:integration:network` job. Shared temp-repo
 * scaffolding lives in tests/helpers/pre-commit-hook-fixture.ts.
 */
import { readFileSync } from "node:fs";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  HOOK_SOURCE,
  buildDemoFile,
  makeHookFixture,
} from "../helpers/pre-commit-hook-fixture";

const fx = makeHookFixture();
beforeEach(() => fx.setup());
afterEach(() => fx.teardown());

describe("BL-027-F004 · Material Symbols pre-commit hook (network-free)", () => {
  it("happy path: no icon-affecting files staged → hook exits 0 without running regen", () => {
    // Stage a docs change. The hook's section-2 grep should not even
    // open this file (path doesn't match src/*.tsx or the manifest).
    fx.stageFile("docs/random-note.md", "# anything\n");

    const result = fx.runHook();
    expect(result.exitCode, `hook should pass; stderr: ${result.stderr}`).toBe(0);
    // Confirm section 2 short-circuited (no "verifying woff2" log).
    expect(result.stdout).not.toMatch(/verifying woff2/);
  });

  it("hook still validates state-machine JSON (section 1 unaffected by section 2 addition)", () => {
    // Regression check: confirm the BL-027-F004 extension didn't
    // break the original 铁律 #11 JSON-validation behavior.
    fx.stageFile("progress.json", "{ this is not valid JSON }");

    const result = fx.runHook();
    expect(result.exitCode).not.toBe(0);
    expect(result.stdout).toMatch(/progress\.json JSON parse failed/);
  });

  it("a regen-script failure surfaces as an explicit rejection (not a silent pass)", () => {
    // Sabotage the script so it exits 1. The hook should reject with
    // a clear "$REGEN_SCRIPT failed" message rather than silently
    // assuming the woff2 is up-to-date. (No network: the script never
    // reaches its curl step.)
    fx.stageFile("scripts/regenerate-material-symbols-subset.sh", `#!/usr/bin/env bash\nexit 1\n`);
    fx.stageFile("src/components/Demo.tsx", buildDemoFile());

    const result = fx.runHook();
    expect(result.exitCode).not.toBe(0);
    expect(result.stdout).toMatch(/regenerate-material-symbols-subset\.sh failed/);
  });
});

// Sanity-check that the source file the test reads from the repo is
// actually the multi-section v0.9.7 hook, not the legacy single-section
// version. Catches a future revert that drops section 2.
describe("BL-027-F004 · pre-commit hook source", () => {
  it("includes the BL-027-F004 Material Symbols section", () => {
    const source = readFileSync(HOOK_SOURCE, "utf8");
    expect(source).toMatch(/BL-027-F004/);
    expect(source).toMatch(/Material Symbols subset coverage/);
    expect(source).toMatch(/regenerate-material-symbols-subset\.sh/);
  });
});

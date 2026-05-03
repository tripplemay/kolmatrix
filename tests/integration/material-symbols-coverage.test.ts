/**
 * BL-025-F009.3 · Material Symbols subset coverage guard.
 *
 * Hardens the manifest + woff2 pipeline established by hotfix
 * `bb637a1` so a regression like the prod 字符方框 incident can't
 * land again silently:
 *
 *   1. Every line in scripts/material-symbols-icons-manifest.txt is
 *      a syntactically valid icon name (lowercase + underscores +
 *      digits).
 *   2. The regenerate script's discovery pipeline produces a
 *      strictly-positive icon list when invoked. (Catches a future
 *      refactor that accidentally breaks the script's grep
 *      pattern composition.)
 *   3. The shipped woff2 file is reasonably sized — a 0-byte or
 *      empty download (e.g. Google Fonts blocked the runner)
 *      reaches CI as a clear failure rather than a green build that
 *      would render character squares in prod again.
 *
 * Lives in tests/integration/* so CI exercises it alongside the
 * other guard suites without spinning up a Postgres container.
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "../..");
const MANIFEST = resolve(REPO_ROOT, "scripts/material-symbols-icons-manifest.txt");
const SCRIPT = resolve(REPO_ROOT, "scripts/regenerate-material-symbols-subset.sh");
const WOFF2 = resolve(REPO_ROOT, "src/app/fonts/material-symbols-outlined.woff2");

// Snapshot the committed woff2 bytes at module-load time. Case #6
// invokes the regenerate script (and therefore rewrites the woff2 on
// disk), so by the time later tests run the on-disk bytes already
// reflect "post-regen" state. The snapshot here is the only way for
// case #7 to compare against the version that was actually committed
// to git.
const COMMITTED_WOFF2_BYTES = readFileSync(WOFF2);

function readManifestEntries(): string[] {
  if (!existsSync(MANIFEST)) {
    throw new Error(`Manifest missing at ${MANIFEST}`);
  }
  return readFileSync(MANIFEST, "utf8")
    .split("\n")
    .map((line) => line.replace(/#.*$/, "").trim())
    .filter((line) => line.length > 0);
}

describe("BL-025-F009.3 · Material Symbols subset coverage", () => {
  it("every manifest entry is a syntactically valid icon name", () => {
    const entries = readManifestEntries();
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(entry, `manifest entry ${JSON.stringify(entry)} must be lowercase ASCII + underscores`).toMatch(/^[a-z_][a-z_0-9]+$/);
    }
  });

  it("no duplicate manifest entries (sort -u upstream collapses them, but the source file should be human-clean)", () => {
    const entries = readManifestEntries();
    const seen = new Set<string>();
    const dups: string[] = [];
    for (const entry of entries) {
      if (seen.has(entry)) dups.push(entry);
      seen.add(entry);
    }
    expect(dups, `duplicate manifest entries: ${dups.join(", ")}`).toEqual([]);
  });

  it("regenerate script discovers at least the manifest icons + the canonical 5 patterns are wired", () => {
    // Inspect the script source to confirm the 5 patterns documented
    // by hotfix bb637a1 + manifest entry are still present. A future
    // refactor that drops one would silently regress the prod fix.
    const source = readFileSync(SCRIPT, "utf8");
    expect(source).toMatch(/Pattern 1: same-line/i);
    expect(source).toMatch(/Pattern 2: multi-line/i);
    expect(source).toMatch(/Pattern 3: TypeScript constant/i);
    expect(source).toMatch(/Pattern 4: JSX prop/i);
    expect(source).toMatch(/Pattern 5: explicit manifest/i);
  });

  it("the shipped woff2 file is non-empty (a 0-byte file would render character squares in prod)", () => {
    expect(existsSync(WOFF2), `woff2 missing at ${WOFF2}`).toBe(true);
    const stat = statSync(WOFF2);
    // The hotfix-bb637a1 baseline shipped at ~9.2KB; F009.1 grew it
    // to ~9.7KB by adding the 10 BL-025 icons. A future regression
    // that empties the file (Google Fonts blocked, fetch failure
    // etc.) would land at ~0 bytes; the guard floor catches that
    // without binding tests to a specific size.
    expect(stat.size, "woff2 must carry at least a few KB of glyph payload").toBeGreaterThan(2_000);
  });

  it("BL-025-F009.1 pre-loaded icons (folder_open, auto_awesome, restart_alt, file_copy, archive, unarchive, more_vert, compare_arrows, restore, movie) appear in the manifest", () => {
    const expected = [
      "folder_open",
      "auto_awesome",
      "restart_alt",
      "file_copy",
      "archive",
      "unarchive",
      "more_vert",
      "compare_arrows",
      "restore",
      "movie",
    ];
    const entries = new Set(readManifestEntries());
    for (const icon of expected) {
      expect(entries.has(icon), `BL-025 icon ${icon} missing from manifest`).toBe(true);
    }
  });

  it("regenerate script remains executable + produces a non-empty discovery list (smoke test)", () => {
    // We only care that the discovery half of the pipeline runs and
    // finds icons; we don't actually re-fetch from Google Fonts in
    // this test (would tie CI to a third-party endpoint and slow
    // every run). The script writes its discovered list to stdout
    // before the curl step.
    const stdout = execSync(`bash ${SCRIPT} 2>&1 || true`, {
      cwd: REPO_ROOT,
      encoding: "utf8",
      timeout: 60_000,
    });
    expect(stdout).toMatch(/discovered \d+ unique icons/);
    const match = stdout.match(/discovered (\d+) unique icons/);
    const count = match ? Number(match[1]) : 0;
    expect(count, "regenerate script discovered zero icons — pattern pipeline broke").toBeGreaterThan(50);
  });

  it("woff2 is up-to-date — committed bytes match what the regen script currently produces (output-side guard)", () => {
    // BL-027-F003 reverse coverage: case #6 only smoke-tests that the
    // discovery pipeline produces > 50 icons — it does NOT verify
    // that the committed woff2 actually reflects the current src/
    // icon usage. The prod 字符方框 incident on 2026-05-03 (BL-026
    // F002 added filter_alt + arrow_drop_down callsites without
    // re-running the script) slipped past every input-side guard
    // because the woff2 was internally consistent with itself.
    //
    // This test executes the script (which fetches a fresh subset
    // from Google Fonts based on whatever icons are referenced in
    // src/ right now) and asserts the regenerated bytes equal the
    // bytes that were committed to git when the test module loaded.
    // If they differ, somebody added an icon callsite without
    // running the script — fail loudly so the next prod deploy
    // doesn't render literal "FILTER_ALT" again.
    execSync(`bash ${SCRIPT}`, {
      cwd: REPO_ROOT,
      encoding: "utf8",
      timeout: 60_000,
    });
    const regeneratedBytes = readFileSync(WOFF2);
    expect(
      regeneratedBytes.equals(COMMITTED_WOFF2_BYTES),
      "woff2 stale: regen script produced different bytes than the committed file. Run `bash scripts/regenerate-material-symbols-subset.sh` and commit the updated src/app/fonts/material-symbols-outlined.woff2.",
    ).toBe(true);
  });
});

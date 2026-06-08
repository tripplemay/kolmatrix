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

import * as fontkit from "fontkit";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "../..");
const MANIFEST = resolve(REPO_ROOT, "scripts/material-symbols-icons-manifest.txt");
const SCRIPT = resolve(REPO_ROOT, "scripts/regenerate-material-symbols-subset.sh");
const WOFF2 = resolve(REPO_ROOT, "src/app/fonts/material-symbols-outlined.woff2");

/**
 * BL-094-F001: run the regenerate script in DISCOVER_ONLY mode (network-free —
 * it greps src/ + manifest and exits BEFORE the Google Fonts fetch) and parse
 * the printed icon list. This is the exact set of icons referenced in the
 * codebase that the shipped subset must cover.
 */
function discoverReferencedIcons(): string[] {
  const stdout = execSync(`DISCOVER_ONLY=1 bash ${SCRIPT}`, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    timeout: 60_000,
  });
  return stdout
    .split("\n")
    .map((line) => {
      const m = line.match(/^ {2}- ([a-z_][a-z_0-9]*)$/);
      return m ? m[1] : null;
    })
    .filter((x): x is string => x !== null);
}

/**
 * BL-094-F001: glyph-coverage check via fontkit. A Material Symbols icon
 * renders through a GSUB ligature (the literal text "filter_alt" collapses to
 * one icon glyph). If the subset covers the icon, layout() returns a single
 * non-.notdef glyph; if not, it falls back to per-character glyphs. This is
 * robust to Google Fonts rebuilding the subset with different bytes (the old
 * byte-equal guard's flakiness) — it only asserts the icon is *renderable*.
 */
function woff2CoversIcon(font: ReturnType<typeof fontkit.create>, icon: string): boolean {
  const run = (font as { layout: (s: string) => { glyphs: { id: number }[] } }).layout(icon);
  return run.glyphs.length === 1 && run.glyphs[0].id !== 0;
}

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

  it("BL-025-F009.1 dynamic-position icons (auto_awesome, archive, file_copy, movie, unarchive) remain in the manifest", () => {
    // BL-055-F004 retro: the original 10-icon list dropped 5 entries
    // that Pattern 1/2 already catch directly in src/ (folder_open,
    // more_vert, restart_alt, restore are caught by the multi-line
    // span pattern; compare_arrows became truly unreferenced after
    // BL-052). The 5 below stay manifest-only because their callsites
    // hit dynamic positions (JSX prop expression / array element /
    // ternary) that the script's grep heuristics can't see.
    const expected = [
      "auto_awesome",
      "archive",
      "file_copy",
      "movie",
      "unarchive",
    ];
    const entries = new Set(readManifestEntries());
    for (const icon of expected) {
      expect(entries.has(icon), `BL-025 icon ${icon} missing from manifest`).toBe(true);
    }
  });

  it("regenerate script remains executable + produces a non-empty discovery list (smoke test)", () => {
    // BL-094-F001: run in DISCOVER_ONLY mode — the discovery half of the
    // pipeline runs (grep src/ + manifest) and the script exits before the
    // Google Fonts curl. Network-free, so this no longer ties CI to a
    // third-party endpoint nor flakes on its latency.
    const stdout = execSync(`DISCOVER_ONLY=1 bash ${SCRIPT}`, {
      cwd: REPO_ROOT,
      encoding: "utf8",
      timeout: 60_000,
    });
    expect(stdout).toMatch(/discovered \d+ unique icons/);
    const match = stdout.match(/discovered (\d+) unique icons/);
    const count = match ? Number(match[1]) : 0;
    expect(count, "regenerate script discovered zero icons — pattern pipeline broke").toBeGreaterThan(50);
  });

  it("committed woff2 covers every referenced icon (glyph-coverage output-side guard)", () => {
    // BL-027-F003 reverse coverage: case #6 only smoke-tests that the
    // discovery pipeline produces > 50 icons — it does NOT verify that the
    // committed woff2 actually reflects current src/ icon usage. The prod
    // 字符方框 incident on 2026-05-03 (BL-026 F002 added filter_alt +
    // arrow_drop_down callsites without re-running the script) slipped past
    // every input-side guard because the woff2 was internally consistent.
    //
    // BL-094-F001: this used to re-fetch from Google Fonts and assert
    // byte-equality with the committed file — which flaked whenever Google
    // rebuilt the subset (same glyphs, different bytes) AND tied CI to an
    // external endpoint. We now assert GLYPH coverage instead: every icon
    // referenced in src/ (discovered network-free) must be renderable by the
    // committed woff2 via its ligature. This still catches "added an icon
    // callsite without regenerating the subset" (the new icon's ligature
    // won't resolve) but is immune to upstream byte drift and needs no
    // network.
    const icons = discoverReferencedIcons();
    expect(icons.length, "DISCOVER_ONLY produced no icons — discovery pipeline broke").toBeGreaterThan(50);

    const font = fontkit.create(readFileSync(WOFF2));
    const uncovered = icons.filter((icon) => !woff2CoversIcon(font, icon));
    expect(
      uncovered,
      `committed woff2 is missing glyphs for: ${uncovered.join(", ")}. ` +
        `Run \`bash scripts/regenerate-material-symbols-subset.sh\` and commit the updated ` +
        `src/app/fonts/material-symbols-outlined.woff2.`,
    ).toEqual([]);
  });
});

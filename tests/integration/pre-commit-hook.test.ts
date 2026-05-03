/**
 * BL-027-F004 · Pre-commit hook Material Symbols subset coverage.
 *
 * Verifies the hook in framework/templates/pre-commit-hook.sh:
 *   1. Doesn't run the (slow) regenerate script when no staged file
 *      could possibly affect icon coverage (state-machine commits,
 *      docs, README edits ...).
 *   2. Accepts the commit when icon callsites changed AND the
 *      regenerated woff2 matches the staged woff2.
 *   3. Rejects the commit (exit ≠ 0) when icon callsites changed,
 *      the regen script produces a different woff2, but that woff2
 *      was NOT staged — the exact prod-bug pattern from BL-026 F002.
 *
 * Implementation notes:
 *   - Each test stages the real regenerate script + manifest from
 *     this repo into a fresh temp git repo, so the network call to
 *     Google Fonts that the script needs really does happen. That's
 *     why this lives in tests/integration/* with the longer timeout.
 *   - We invoke the hook directly with `bash hook` from within the
 *     temp repo's working directory; that's exactly how
 *     .git/hooks/pre-commit is invoked by `git commit`.
 */
import { execFileSync, execSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "../..");
const HOOK_SOURCE = join(REPO_ROOT, "framework/templates/pre-commit-hook.sh");
const REGEN_SOURCE = join(REPO_ROOT, "scripts/regenerate-material-symbols-subset.sh");
const MANIFEST_SOURCE = join(REPO_ROOT, "scripts/material-symbols-icons-manifest.txt");
const WOFF2_SOURCE = join(REPO_ROOT, "src/app/fonts/material-symbols-outlined.woff2");

let workdir: string;

function git(...args: string[]): string {
  return execFileSync("git", args, { cwd: workdir, encoding: "utf8" });
}

function runHook(): { exitCode: number; stdout: string; stderr: string } {
  try {
    const stdout = execSync(`bash .git/hooks/pre-commit`, {
      cwd: workdir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { exitCode: 0, stdout, stderr: "" };
  } catch (err) {
    const e = err as { status?: number; stdout?: Buffer | string; stderr?: Buffer | string };
    return {
      exitCode: e.status ?? 1,
      stdout: typeof e.stdout === "string" ? e.stdout : (e.stdout?.toString("utf8") ?? ""),
      stderr: typeof e.stderr === "string" ? e.stderr : (e.stderr?.toString("utf8") ?? ""),
    };
  }
}

function stageFile(relPath: string, contents: string | Buffer): void {
  const abs = join(workdir, relPath);
  mkdirSync(join(abs, ".."), { recursive: true });
  if (typeof contents === "string") {
    writeFileSync(abs, contents);
  } else {
    writeFileSync(abs, contents);
  }
  git("add", relPath);
}

function copyAsset(srcAbs: string, destRel: string): void {
  const destAbs = join(workdir, destRel);
  mkdirSync(join(destAbs, ".."), { recursive: true });
  copyFileSync(srcAbs, destAbs);
}

beforeEach(() => {
  workdir = mkdtempSync(join(tmpdir(), "pre-commit-hook-"));
  // Initialize git repo with deterministic identity to keep stage/diff
  // commands quiet.
  git("init", "-q");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "test");
  git("commit", "--allow-empty", "-q", "-m", "init");

  // Wire the hook (just the file — chmod +x not strictly needed since
  // we invoke via `bash hook` in runHook()).
  mkdirSync(join(workdir, ".git/hooks"), { recursive: true });
  copyFileSync(HOOK_SOURCE, join(workdir, ".git/hooks/pre-commit"));

  // Copy the real regenerate script and manifest so the hook's section 2
  // can run end-to-end.
  copyAsset(REGEN_SOURCE, "scripts/regenerate-material-symbols-subset.sh");
  copyAsset(MANIFEST_SOURCE, "scripts/material-symbols-icons-manifest.txt");
  copyAsset(WOFF2_SOURCE, "src/app/fonts/material-symbols-outlined.woff2");
});

afterEach(() => {
  if (workdir) {
    rmSync(workdir, { recursive: true, force: true });
  }
});

describe("BL-027-F004 · Material Symbols pre-commit hook", () => {
  it("happy path: no icon-affecting files staged → hook exits 0 without running regen", () => {
    // Stage a docs change. The hook's section-2 grep should not even
    // open this file (path doesn't match src/*.tsx or the manifest).
    stageFile("docs/random-note.md", "# anything\n");

    const result = runHook();
    expect(result.exitCode, `hook should pass; stderr: ${result.stderr}`).toBe(0);
    // Confirm section 2 short-circuited (no "verifying woff2" log).
    expect(result.stdout).not.toMatch(/verifying woff2/);
  });

  it("icon staged + woff2 matches script output → hook PASS", () => {
    // Touch an existing .tsx-shaped file with an icon callsite. The
    // committed woff2 already covers every icon in the real src/
    // (because we copied the real manifest + real woff2). The regen
    // script will fetch the same byte-identical woff2 from Google
    // Fonts, so before_hash == after_hash and the hook should pass
    // via the "already up-to-date" branch.
    stageFile("src/components/Demo.tsx", buildDemoFile());
    // Stage the real woff2 too (simulates Generator running the script
    // and committing alongside the icon change).
    git("add", "src/app/fonts/material-symbols-outlined.woff2");

    const result = runHook();
    expect(result.exitCode, `hook should pass; stderr: ${result.stderr}\nstdout: ${result.stdout}`).toBe(0);
    expect(result.stdout).toMatch(/detected Material Symbols icon callsite/);
    // Either branch of the "matches" check is acceptable — what we're
    // proving is that the hook didn't reject.
    expect(result.stdout).toMatch(/up-to-date|matches script output/);
  }, 90_000);

  it("icon staged + woff2 changes but is NOT staged → hook REJECTS with clear message", () => {
    // Drop the woff2 down to a known-stale state by replacing it with
    // a tiny placeholder. The regen script will fetch the real subset
    // from Google Fonts (matching the staged manifest), and the
    // before_hash != after_hash branch will fire. Since we never
    // `git add` the woff2, the hook should reject.
    writeFileSync(join(workdir, "src/app/fonts/material-symbols-outlined.woff2"), "stale-placeholder-bytes");

    stageFile("src/components/Demo.tsx", buildDemoFile());
    // Intentionally do NOT stage src/app/fonts/material-symbols-outlined.woff2.

    const result = runHook();
    expect(result.exitCode, "hook should reject when woff2 was regenerated but not staged").not.toBe(0);
    expect(result.stdout).toMatch(/woff2 was regenerated by the script but is NOT staged/);
    expect(result.stdout).toMatch(/git add src\/app\/fonts\/material-symbols-outlined\.woff2/);
  }, 90_000);

  it("hook still validates state-machine JSON (section 1 unaffected by section 2 addition)", () => {
    // Regression check: confirm the BL-027-F004 extension didn't
    // break the original 铁律 #11 JSON-validation behavior.
    stageFile("progress.json", "{ this is not valid JSON }");

    const result = runHook();
    expect(result.exitCode).not.toBe(0);
    expect(result.stdout).toMatch(/progress\.json JSON parse failed/);
  });

  it("a regen-script failure surfaces as an explicit rejection (not a silent pass)", () => {
    // Sabotage the script so it exits 1. The hook should reject with
    // a clear "$REGEN_SCRIPT failed" message rather than silently
    // assuming the woff2 is up-to-date.
    writeFileSync(
      join(workdir, "scripts/regenerate-material-symbols-subset.sh"),
      `#!/usr/bin/env bash\nexit 1\n`,
    );
    stageFile("src/components/Demo.tsx", buildDemoFile());

    const result = runHook();
    expect(result.exitCode).not.toBe(0);
    expect(result.stdout).toMatch(/regenerate-material-symbols-subset\.sh failed/);
  });
});

/**
 * Build a fixture that satisfies every pattern in regenerate-material-symbols-subset.sh.
 *
 * The script uses `set -euo pipefail`, so a grep stage that returns
 * zero matches aborts the entire pipeline. Real src/ has at least one
 * match for each of the 5 patterns; our test fixture must too, or the
 * script will exit 1 in the temp repo even though the hook logic
 * itself is correct.
 */
function buildDemoFile(): string {
  return [
    'import * as React from "react";',
    "",
    "// Pattern 1 (same-line span > icon < span):",
    'export const InlineIcon = () => (',
    '  <span className="material-symbols-outlined">close</span>',
    ");",
    "",
    "// Pattern 2 (multi-line — icon name on its own line):",
    "export const MultiLineIcon = () => (",
    '  <span className="material-symbols-outlined">',
    "    filter_alt",
    "  </span>",
    ");",
    "",
    "// Pattern 3 (TS constant `icon: \"name\"`):",
    'export const META = { icon: "send" } as const;',
    "",
    "// Pattern 4 (JSX prop icon=\"name\"):",
    'export const PropIcon = ({ Component }: any) => <Component icon="edit" />;',
    "",
  ].join("\n");
}

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

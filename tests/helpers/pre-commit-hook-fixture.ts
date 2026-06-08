/**
 * BL-094-F001 · Shared fixture for the pre-commit hook integration tests.
 *
 * Extracted from tests/integration/pre-commit-hook.test.ts so the network-free
 * cases (pre-commit-hook.test.ts) and the network-dependent cases that run the
 * real regenerate script against Google Fonts (pre-commit-hook.network.test.ts)
 * can share one copy of the temp-repo scaffolding without drift.
 */
import { execFileSync, execSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

export const REPO_ROOT = resolve(__dirname, "../..");
export const HOOK_SOURCE = join(REPO_ROOT, "framework/templates/pre-commit-hook.sh");
export const REGEN_SOURCE = join(REPO_ROOT, "scripts/regenerate-material-symbols-subset.sh");
export const MANIFEST_SOURCE = join(REPO_ROOT, "scripts/material-symbols-icons-manifest.txt");
export const WOFF2_SOURCE = join(REPO_ROOT, "src/app/fonts/material-symbols-outlined.woff2");

export interface HookFixture {
  /** Absolute path of the current temp git repo (valid between setup/teardown). */
  readonly workdir: string;
  setup(): void;
  teardown(): void;
  git(...args: string[]): string;
  runHook(): { exitCode: number; stdout: string; stderr: string };
  stageFile(relPath: string, contents: string | Buffer): void;
}

export function makeHookFixture(): HookFixture {
  let workdir = "";

  function git(...args: string[]): string {
    return execFileSync("git", args, { cwd: workdir, encoding: "utf8" });
  }

  function copyAsset(srcAbs: string, destRel: string): void {
    const destAbs = join(workdir, destRel);
    mkdirSync(join(destAbs, ".."), { recursive: true });
    copyFileSync(srcAbs, destAbs);
  }

  return {
    get workdir() {
      return workdir;
    },
    setup() {
      workdir = mkdtempSync(join(tmpdir(), "pre-commit-hook-"));
      git("init", "-q");
      git("config", "user.email", "test@example.com");
      git("config", "user.name", "test");
      git("commit", "--allow-empty", "-q", "-m", "init");

      // Wire the hook (just the file — chmod +x not strictly needed since
      // we invoke via `bash hook` in runHook()).
      mkdirSync(join(workdir, ".git/hooks"), { recursive: true });
      copyFileSync(HOOK_SOURCE, join(workdir, ".git/hooks/pre-commit"));

      // Copy the real regenerate script + manifest + woff2 so the hook's
      // section 2 can run end-to-end.
      copyAsset(REGEN_SOURCE, "scripts/regenerate-material-symbols-subset.sh");
      copyAsset(MANIFEST_SOURCE, "scripts/material-symbols-icons-manifest.txt");
      copyAsset(WOFF2_SOURCE, "src/app/fonts/material-symbols-outlined.woff2");
    },
    teardown() {
      if (workdir) {
        rmSync(workdir, { recursive: true, force: true });
        workdir = "";
      }
    },
    git,
    runHook() {
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
    },
    stageFile(relPath: string, contents: string | Buffer) {
      const abs = join(workdir, relPath);
      mkdirSync(join(abs, ".."), { recursive: true });
      writeFileSync(abs, contents);
      git("add", relPath);
    },
  };
}

/**
 * Build a fixture that satisfies every pattern in
 * regenerate-material-symbols-subset.sh. The script uses `set -euo pipefail`,
 * so a grep stage with zero matches aborts the whole pipeline; the temp repo
 * must contain at least one match for each pattern.
 */
export function buildDemoFile(): string {
  return [
    'import * as React from "react";',
    "",
    "// Pattern 1 (same-line span > icon < span):",
    "export const InlineIcon = () => (",
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
    '// Pattern 3 (TS constant `icon: "name"`):',
    'export const META = { icon: "send" } as const;',
    "",
    '// Pattern 4 (JSX prop icon="name"):',
    'export const PropIcon = ({ Component }: any) => <Component icon="edit" />;',
    "",
  ].join("\n");
}

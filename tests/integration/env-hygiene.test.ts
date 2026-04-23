/**
 * Regression guard for BAux1 reverifying round 2 (2026-04-23).
 *
 * Evaluator reported /login still redirecting to `http://localhost:3000`
 * on the Codex :3099 flow despite .env.example commenting out
 * NEXTAUTH_URL. Root cause: scripts/test/codex-setup.sh only cp's
 * .env.example → .env when .env is missing, so Evaluator machines that
 * ran setup on an older revision kept the stale NEXTAUTH_URL value.
 *
 * This test file guards the three invariants that, together, make the
 * Codex L1 flow reproducible:
 *
 *   1. .env.example must NOT ship NEXTAUTH_URL / AUTH_URL uncommented
 *      (so fresh copies never inherit the origin-rewrite bug).
 *   2. scripts/test/codex-setup.sh must sanitize pre-existing .env on
 *      every run (so upgrade paths from older checkouts self-heal).
 *   3. scripts/test/codex-e2e.sh must exist and set the env contract
 *      (E2E_PORT=3099, NEXTAUTH_URL/AUTH_URL unset, proxies stripped)
 *      so Evaluator has a one-command wrapper instead of remembering
 *      the dance by hand.
 *
 * All three are string assertions against files checked into the repo;
 * they don't require the DB container or the dev server. Kept under
 * tests/integration/ so they ship with the existing Codex `npm run
 * test:integration` command rather than gating the faster unit suite.
 */
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..");

function read(relPath: string): string {
  return readFileSync(resolve(REPO_ROOT, relPath), "utf8");
}

describe(".env.example origin hygiene", () => {
  const content = read(".env.example");

  it("does not ship an uncommented NEXTAUTH_URL", () => {
    // Match lines that begin with optional whitespace then NEXTAUTH_URL=,
    // i.e. actually active assignments (not commented prose).
    const activeLines = content
      .split("\n")
      .filter((line) => /^[\t ]*NEXTAUTH_URL=/.test(line));
    expect(activeLines).toEqual([]);
  });

  it("does not ship an uncommented AUTH_URL", () => {
    const activeLines = content
      .split("\n")
      .filter((line) => /^[\t ]*AUTH_URL=/.test(line));
    expect(activeLines).toEqual([]);
  });

  it("keeps an explanatory comment so future edits don't revert the fix", () => {
    expect(content).toMatch(/reqWithEnvURL|origin/i);
  });
});

describe("scripts/test/codex-setup.sh .env sanitize", () => {
  const content = read("scripts/test/codex-setup.sh");

  it("greps for NEXTAUTH_URL / AUTH_URL in pre-existing .env", () => {
    // Guard is specifically about uncommented assignments.
    expect(content).toMatch(/grep .*NEXTAUTH_URL\|AUTH_URL/);
  });

  it("uses sed to comment those assignments out", () => {
    expect(content).toMatch(/sed .*NEXTAUTH_URL\|AUTH_URL/);
  });

  it("unsets NEXTAUTH_URL / AUTH_URL before exec npm run dev", () => {
    // The unset must happen before the exec line so the child process
    // never sees a stale shell export (belt-and-suspenders alongside
    // the file sanitize).
    const unsetIdx = content.indexOf("unset NEXTAUTH_URL AUTH_URL");
    const execIdx = content.indexOf("exec npm run dev");
    expect(unsetIdx).toBeGreaterThan(-1);
    expect(execIdx).toBeGreaterThan(-1);
    expect(unsetIdx).toBeLessThan(execIdx);
  });
});

describe("scripts/test/codex-e2e.sh Playwright wrapper", () => {
  const relPath = "scripts/test/codex-e2e.sh";
  const absPath = resolve(REPO_ROOT, relPath);

  it("exists and is executable", () => {
    const stat = statSync(absPath);
    // Owner execute bit — covers both 0o755 and 0o700 local checkouts.
    expect(stat.mode & 0o100).toBe(0o100);
  });

  it("sets E2E_PORT default to 3099 (Codex contract)", () => {
    const content = read(relPath);
    expect(content).toMatch(/E2E_PORT[:=]"?\$\{E2E_PORT:-3099\}"?/);
  });

  it("unsets NEXTAUTH_URL and AUTH_URL", () => {
    const content = read(relPath);
    expect(content).toMatch(/unset\s+NEXTAUTH_URL\s+AUTH_URL/);
  });

  it("strips proxy env to avoid 502 on localhost", () => {
    const content = read(relPath);
    expect(content).toMatch(/unset.*all_proxy/i);
  });

  it("forwards extra args into playwright test invocation", () => {
    const content = read(relPath);
    expect(content).toMatch(/exec npx playwright test "\$@"/);
  });
});

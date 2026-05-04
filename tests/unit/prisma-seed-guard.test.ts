/**
 * BL-034 F002 — prisma/seed.ts production guard regression test.
 *
 * Spawns `tsx prisma/seed.ts` in a child process under different env
 * combinations and asserts:
 *   - NODE_ENV=production → exits non-zero with "Forbidden in production"
 *     before any DB call
 *   - NODE_ENV=development without SEED_ADMIN_PASSWORD → console.warn
 *     about default password fires before main() touches the DB
 *   - SEED_ADMIN_PASSWORD set → console.warn does NOT fire
 *
 * The seed bottom-of-file `main().catch(...)` will eventually fail when
 * pointed at an unreachable DB; we only assert the early stderr/exit
 * behavior produced by the guard + warn block, not seed completion.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(__dirname, "../..");
const SEED_PATH = path.join(REPO_ROOT, "prisma/seed.ts");
const TSX_BIN = path.join(REPO_ROOT, "node_modules/.bin/tsx");

const UNREACHABLE_DB =
  "postgresql://kolmatrix_app:wrong@127.0.0.1:1/kolmatrix?schema=public&connect_timeout=1";

function runSeed(env: Record<string, string | undefined>): {
  status: number | null;
  stdout: string;
  stderr: string;
} {
  // Strip NODE_ENV / SEED_ADMIN_PASSWORD / DATABASE_*_URL from inherited
  // env so the test's overrides win (and the dev case really lacks
  // SEED_ADMIN_PASSWORD even when the developer has it exported).
  const sanitized: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (
      v === undefined ||
      k === "NODE_ENV" ||
      k === "SEED_ADMIN_PASSWORD" ||
      k === "DATABASE_URL" ||
      k === "DATABASE_ADMIN_URL"
    ) {
      continue;
    }
    sanitized[k] = v;
  }
  const merged: Record<string, string> = {
    ...sanitized,
    DATABASE_ADMIN_URL: UNREACHABLE_DB,
    DATABASE_URL: UNREACHABLE_DB,
  };
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) continue;
    merged[k] = v;
  }
  const result = spawnSync(TSX_BIN, [SEED_PATH], {
    cwd: REPO_ROOT,
    // Cast: project augments NodeJS.ProcessEnv with required NODE_ENV
    // (Next.js types). At runtime NODE_ENV is supplied per-test.
    env: merged as NodeJS.ProcessEnv,
    encoding: "utf8",
    timeout: 20_000,
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

describe("prisma/seed.ts BL-034 F002 guards", () => {
  it("hard-throws when NODE_ENV=production before any DB connection", () => {
    const { status, stderr } = runSeed({ NODE_ENV: "production" });
    expect(status).not.toBe(0);
    expect(stderr).toMatch(/Forbidden in production/);
    // Sanity: should not have proceeded to DB connect attempts (those
    // would surface a Prisma "P1001" or socket error). The guard fires
    // synchronously at module load.
    expect(stderr).not.toMatch(/P1001|ECONNREFUSED/);
  });

  it("emits 'Using default password' warning in dev without SEED_ADMIN_PASSWORD", () => {
    const { stderr } = runSeed({ NODE_ENV: "development" });
    expect(stderr).toMatch(/Using default password/);
  });

  it("does NOT emit default-password warning when SEED_ADMIN_PASSWORD is set", () => {
    const { stderr } = runSeed({
      NODE_ENV: "development",
      SEED_ADMIN_PASSWORD: "test-override-123",
    });
    expect(stderr).not.toMatch(/Using default password/);
  });
});

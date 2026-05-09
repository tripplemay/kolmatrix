import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for KOLMatrix E2E suite.
 *
 * F003 scope: desktop Chromium, 1440x900 viewport, auto-starts
 * `npm run dev` as the web server. Screenshots + traces retained on
 * failure so Evaluator can triage a red run without rerunning locally.
 *
 * F008 (marketer login flow) and F009 (visual regression) layer on top
 * of this config without touching it.
 *
 * Port/baseURL resolution order (lets Codex reuse its 3099 dev server
 * without editing this file):
 *   1. E2E_BASE_URL — full URL override (e.g. http://127.0.0.1:3099)
 *   2. E2E_PORT     — port-only override; host stays `localhost`
 *   3. PORT         — fallback, matches Next dev server convention
 *   4. 3000         — historical default, kept for CI + local dev
 *
 * Host MUST default to `localhost` (not 127.0.0.1). CI sets
 * NEXTAUTH_URL=http://localhost:3000 and next-auth's reqWithEnvURL()
 * rewrites req origin to that value on every request — if Playwright
 * visits 127.0.0.1 the origin mismatch breaks credentials POST CSRF +
 * session cookie scoping, and every login-gated test times out on
 * waitForURL('/dashboard'). Next 16 dev also blocks cross-origin
 * `_next/webpack-hmr` from 127.0.0.1 unless it's in `allowedDevOrigins`.
 *
 * Codex flow: `scripts/test/codex-setup.sh` starts Next on :3099, then
 * `E2E_BASE_URL=http://127.0.0.1:3099 npm run test:e2e` reuses it.
 * (Codex .env has NEXTAUTH_URL unset — see .env.example — so there is
 * no origin-rewrite conflict on 127.0.0.1 for that environment.)
 */
const E2E_PORT = process.env.E2E_PORT ?? process.env.PORT ?? "3000";
const E2E_BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${E2E_PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  // F009 visual regression baselines live at a predictable repo-tracked
  // path instead of the Playwright default ({testFilePath}-snapshots/)
  // so the team can review and diff them directly in git.
  snapshotPathTemplate: "tests/screenshots/baseline/{arg}{ext}",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Always emit playwright-report/ HTML so screenshots + traces from a
  // failure are inspectable locally without rerunning (spec F003 acceptance).
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: E2E_BASE_URL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    viewport: { width: 1440, height: 900 },
  },
  // BL-049-F003: split the visual-regression suite from the rest of the
  // E2E run via Playwright projects. The "visual" project owns
  // visual-regression.spec.ts and runs first (read-only — login + navigate
  // + screenshot, no mutations). The "chromium" project runs every other
  // spec and depends on "visual", which forces project-level sequencing
  // even with `fullyParallel: true`. This eliminates the historic race
  // where bm1-flow / journey / outreach mutations leaked into
  // visual-regression screenshots, and lets us drop the in-CI
  // `npm run db:seed` reseed step (visual leaves the DB pristine, so
  // chromium starts on the same fresh seed without re-running it).
  //
  // Why not 2 DBs (audit "Path A"): the savings would buy us a few
  // seconds at most while doubling the CI ops surface (postgres service
  // container × 2, two DATABASE_URLs, second Next dev server). Project
  // dependencies give us the same isolation guarantee — no chromium
  // mutation can cross over because the chromium project never starts
  // until every visual spec (including retries) has finished.
  projects: [
    {
      name: "visual",
      testMatch: /visual-regression\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"] },
    },
    // BL-060 fix-round 2 — auth setup project. Logs in once and
    // saves storageState to playwright/.auth/marketer.json. Specs
    // that need a pre-authenticated session opt in via
    // `test.use({ storageState: "playwright/.auth/marketer.json" })`
    // — currently database-fidelity.spec.ts (was suffering 7-case
    // cumulative login flake on staging). Specs that test the login
    // flow itself (login-cinematic.spec.ts) leave the default empty
    // state alone.
    {
      name: "setup",
      testMatch: /marketer\.setup\.ts$/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium",
      testIgnore: /(visual-regression|marketer\.setup)\.ts$/,
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["visual", "setup"],
    },
  ],
  webServer: {
    // Pass PORT so Next dev binds to the same port baseURL points at.
    command: `npm run dev -- --port ${E2E_PORT}`,
    url: E2E_BASE_URL,
    // reuseExistingServer also applies on CI so a pre-started dev server
    // (e.g. from codex-setup.sh in Evaluator runs) isn't stomped on.
    reuseExistingServer: true,
    timeout: 180_000, // Next 16 cold start + Prisma generate can be slow on WSL2.
  },
});

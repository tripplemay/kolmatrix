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
 *   2. E2E_PORT     — port-only override; host defaults to 127.0.0.1
 *   3. PORT         — fallback, matches Next dev server convention
 *   4. 3000         — historical default, kept for CI + local dev
 *
 * Codex flow: `scripts/test/codex-setup.sh` starts Next on :3099, then
 * `E2E_BASE_URL=http://127.0.0.1:3099 npm run test:e2e` reuses it.
 */
const E2E_PORT = process.env.E2E_PORT ?? process.env.PORT ?? "3000";
const E2E_BASE_URL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${E2E_PORT}`;

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
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
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

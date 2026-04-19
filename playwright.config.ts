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
 */
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
    baseURL: "http://localhost:3000",
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
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000, // Next 16 cold start + Prisma generate can be slow on WSL2.
  },
});

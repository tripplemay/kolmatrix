import path from "node:path";

import { defineConfig } from "vitest/config";

/**
 * BL-094-F001 · Network-dependent integration suite.
 *
 * Runs ONLY `tests/integration/**​/*.network.test.ts` — cases that hit an
 * uncontrolled external endpoint (currently fonts.googleapis.com via the
 * Material Symbols regenerate script). Split out from the default integration
 * config so the main suite stays deterministic.
 *
 * Hardening for the external dependency:
 *   - `fileParallelism: false` + `maxWorkers: 1` — serial, so concurrent
 *     Google Fonts subset fetches don't jitter (the original flake root cause).
 *   - `retry: 2` — a transient fetch failure retries instead of red-flagging
 *     the build. CI runs this in its own job so a network blip there doesn't
 *     gate the deterministic suites.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.network.test.ts"],
    exclude: ["node_modules", "dist", ".next"],
    globals: true,
    testTimeout: 120_000,
    hookTimeout: 180_000,
    fileParallelism: false,
    maxWorkers: 1,
    retry: 2,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});

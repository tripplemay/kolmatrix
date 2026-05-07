import { defineConfig } from "vitest/config";
import path from "node:path";

import { COVERAGE_EXCLUSIONS_RUNTIME } from "./vitest.coverage-exclusions";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    // WSL2 跨 /mnt/c/... fs 慢，全代码 fast-glob 在默认 5_000ms 偶发 fail
    // (BIx F005 + BL-025 verifying 两次踩同根因)。CI Linux 容器无此问题。
    // 60s 是上限不是下限，快测试仍快完。来源：framework CHANGELOG v0.9.6 [#1]。
    testTimeout: 60_000,
    include: [
      "src/**/__tests__/**/*.{test,spec}.{ts,tsx}",
      "scripts/**/__tests__/**/*.{test,spec}.{ts,tsx}",
      "tests/unit/**/*.{test,spec}.{ts,tsx}",
      "tests/__example/**/*.{test,spec}.{ts,tsx}",
    ],
    exclude: ["node_modules", "dist", ".next", "tests/integration/**", "tests/e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "coverage",
      // BI1-F006 expanded scope: first B0 unit tests land, so coverage
      // now tracks the lib utilities and the App Shell / common component
      // libraries. App-router server components (app/**/{layout,page}.tsx)
      // stay out because they're validated via E2E + integration.
      include: ["src/lib/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
      // Exclusion list lives in vitest.coverage-exclusions.ts (BL-049-F001)
      // — sidecar file keeps thresholds + reporter wiring readable here
      // while preserving each entry's "why" comment next to its path.
      exclude: COVERAGE_EXCLUSIONS_RUNTIME,
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});

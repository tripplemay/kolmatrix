import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: [
      "src/**/__tests__/**/*.{test,spec}.{ts,tsx}",
      "tests/unit/**/*.{test,spec}.{ts,tsx}",
      "tests/__example/**/*.{test,spec}.{ts,tsx}",
    ],
    exclude: ["node_modules", "dist", ".next", "tests/integration/**", "tests/e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "coverage",
      // NOTE: coverage scope intentionally narrow in F001 — placeholder batch.
      // F006 will expand `include` to `src/lib/**` and `src/components/**` once
      // the first real unit tests land, so the 80% threshold stays meaningful.
      include: ["src/lib/utils.ts"],
      exclude: ["src/**/*.d.ts", "src/**/__tests__/**", "src/**/*.stories.{ts,tsx}"],
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

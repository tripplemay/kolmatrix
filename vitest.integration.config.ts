import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Integration suite talks to a real PostgreSQL container via
    // Testcontainers. Node env + longer timeouts are mandatory.
    environment: "node",
    include: ["tests/integration/**/*.{test,spec}.ts"],
    exclude: ["node_modules", "dist", ".next"],
    globals: true,
    testTimeout: 120_000,
    hookTimeout: 180_000, // container boot + migrate deploy can take ~30s.
    // One worker → keeps the shared container contract simple until F007
    // needs parallelism (at which point each file can start its own).
    fileParallelism: false,
    // No coverage in the integration run; F010 wires coverage on the
    // unit suite only (where thresholds are meaningful).
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});

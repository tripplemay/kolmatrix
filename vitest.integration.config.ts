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
    // BL-049-F002: file-level parallelism with a worker cap. Each fork
    // gets its own module-scoped Testcontainers postgres (per
    // tests/helpers/db.ts `shared` singleton — fork-local), so 4
    // workers × 1 container ≈ 4 containers concurrently. Calibrated to
    // CI runner 7GB RAM / 4 vCPU; dial `maxWorkers` down to 3 if first
    // runs hit memory pressure.
    //
    // Vitest 4 migration: the old `poolOptions.forks.maxForks` shape
    // was removed in favour of top-level `maxWorkers` (covers forks +
    // threads + vmThreads pools uniformly).
    fileParallelism: true,
    maxWorkers: 4,
    // No coverage in the integration run; F010 wires coverage on the
    // unit suite only (where thresholds are meaningful).
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});

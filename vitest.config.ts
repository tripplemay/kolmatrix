import { defineConfig } from "vitest/config";
import path from "node:path";

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
      exclude: [
        "src/**/*.d.ts",
        "src/**/__tests__/**",
        "src/**/*.stories.{ts,tsx}",
        "src/components/ui/**", // shadcn scaffolding, covered via consumer specs
        // Server-only components that call `next-intl/server` are validated
        // via E2E (tests/e2e/login-cinematic.spec.ts +
        // request-access.spec.ts). They can't execute under jsdom because
        // `getTranslations()` lives in the server runtime.
        "src/components/auth/LoginBrandOverlay.tsx",
        "src/components/auth/RequestAccessBrandOverlay.tsx",
        // BM2-F003/F004/F005 DB-touching helpers. These files are
        // dominated by Prisma + withTenant calls and are authoritatively
        // covered by tests/integration/campaign-*.test.ts (each helper
        // has 5-10 specs). Their pure surface (status enum, schema,
        // ROI math, transition rules) is covered by sibling
        // __tests__/*.test.ts files.
        "src/lib/campaigns/detail.ts",
        "src/lib/campaigns/create.ts",
        "src/lib/campaigns/search.ts",
        "src/lib/campaigns/update.ts",
        "src/lib/campaigns/kol-operations.ts",
        // BM2-F006 outreach DB-heavy helpers. Same rationale —
        // integration-tested via tests/integration/outreach-flow.test.ts.
        // Pure helpers (variable-substitute / customize / resend mock
        // path / json-extract) stay under coverage and have their own
        // unit specs.
        "src/lib/email/analytics.ts",
        "src/lib/email/batch-send.ts",
        "src/lib/email/composer-data.ts",
        // BM2-F007 CRM DB-heavy helpers. Integration-tested via
        // tests/integration/crm-overview.test.ts. Pure aggregate.ts
        // stays under coverage with its own unit specs.
        "src/lib/crm/overview.ts",
        "src/lib/crm/update.ts",
        // BM2-F008 ROI DB-heavy loader. Integration-tested via
        // tests/integration/roi.test.ts. Pure compute.ts stays under
        // coverage with its own unit specs.
        "src/lib/roi/queries.ts",
        // BM2-F010 weekly-report DB-heavy helpers. Integration-tested
        // via tests/integration/weekly-report.test.ts. Pure helpers
        // (generate/markdown-split/share-token) stay under coverage
        // with their own unit specs.
        "src/lib/weekly-report/persistence.ts",
        "src/lib/weekly-report/data-assembly.ts",
        "src/lib/db-admin.ts",
        // B7a-F001 DB-heavy embedding orchestrator. The pure surface
        // (text builders, client, sql helpers, event-log emitter) all
        // have unit specs; kol-embed.ts is integration-tested via
        // tests/integration/embedding-pipeline.test.ts (9 specs covering
        // backfill / dirty-check / NULL filter / Product JIT).
        "src/lib/embedding/kol-embed.ts",
        // B7a-F002 DB-heavy Smart Match orchestrator. Pure surface
        // (similarityToScore) has unit specs; the cosine top-K +
        // RLS path is integration-tested via
        // tests/integration/smart-match-api.test.ts (5 specs).
        "src/lib/discovery/smart-match.ts",
        // B5-F004 KOL detail recent-videos loader. Surface is dominated
        // by withTenant + googleapis.youtube calls; the pure
        // helpers (isCacheFresh / readCache / mergeMetadata) are
        // exercised via the loader path. Codex 守门 in F005 covers the
        // happy-path + cache-miss + YT-failure branches via integration.
        "src/lib/kol-detail/recent-videos.ts",
        // B5-F006 KOL detail topic-cloud loader. Same rationale —
        // surface is dominated by withTenant + aigcgateway fetch.
        // Pure helpers (isCacheFresh / readCache / normalizeKeywords /
        // mergeMetadata) are exercised via the loader path. Codex 守门
        // tests in F006 cover cache / mock-success / Action-failure /
        // Action-not-configured branches via integration specs
        // (tests/integration/b5-topic-cloud.test.ts per spec §F006).
        "src/lib/kol-detail/topic-cloud.ts",
        // BIx-F004-P3 Prisma-backed cursor + tier orchestrator. The
        // pure helpers (pickDailyPage / pickBucketSlice /
        // pickTieredRefreshIds / inMemory cursor) are unit-tested
        // exhaustively; the prismaKolSyncCursorProvider /
        // fetchTieredRefreshIds Prisma fan-outs are exercised end-
        // to-end by tests/integration/sync-quota-optimization.test.ts.
        "src/lib/kol-sync/refresh-selector.ts",
        // BIx-F004-P4 googleapis-backed engagement client. Pure
        // orchestrator (runEngagementBatch / computeEngagementRate)
        // is unit-tested; the createEngagementBatchClient adapter
        // calls youtube.channels/playlistItems/videos directly and is
        // covered by the integration smoke when the live API key
        // is set (gated by YOUTUBE_API_TEST=true).
        "src/lib/kol-sync/engagement-batch-client.ts",
      ],
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

// re-trigger CI for F006 against baseline v2 (data-kol-platform=youtube selector)

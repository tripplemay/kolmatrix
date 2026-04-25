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

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

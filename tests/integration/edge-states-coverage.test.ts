/**
 * BIx-mvp-polish-pass F003 — Edge-state coverage guard.
 *
 * Filesystem grep over the 11 critical-path routes the spec lists in
 * §F003. Each one must:
 *   - have an `error.tsx` next to its `page.tsx`
 *   - re-export the shared `<ErrorBoundary>` so unhandled server-
 *     component / suspense errors render a friendly fallback rather
 *     than Next's stark default
 *
 * No DB / no testcontainers — this is a pure file inspection. We
 * keep it under tests/integration/ rather than tests/unit/ because
 * the assertion crosses the app router tree; future spec drift gets
 * caught here even when the offending PR doesn't touch unit tests.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const APP_ROOT = resolve(__dirname, "../../src/app/[locale]/(app)");

const PAGES_THAT_NEED_ERROR_TSX = [
  "dashboard",
  // BL-065-F006 — `discovery` + `database` routes deleted alongside
  // their error.tsx files (the new /match workbench is the
  // replacement surface and ships its own error.tsx).
  "match",
  "kols/[id]",
  "knowledge-base",
  "campaigns",
  "campaigns/[id]",
  // BL-070-F001 — `outreach` route promoted to `reach` (git mv).
  // F004 will delete the legacy route entirely; until then the new
  // /reach directory carries the same `error.tsx`.
  "reach",
  "crm",
  "roi",
  // BL-070-F003 — `weekly-report` route moved to `insight/weekly-report`
  // (git mv) and `insight` got a new error.tsx will be added by F003
  // follow-up if needed. The insight/weekly-report path inherits its
  // existing error.tsx (moved alongside the page.tsx).
  "insight/weekly-report",
] as const;

describe("edge-states coverage (BIx-vf F003)", () => {
  it.each(PAGES_THAT_NEED_ERROR_TSX)(
    "%s/ exposes an error.tsx that re-exports the shared ErrorBoundary",
    (route) => {
      const errorPath = resolve(APP_ROOT, route, "error.tsx");
      expect(existsSync(errorPath), `expected ${route}/error.tsx to exist`).toBe(true);

      const source = readFileSync(errorPath, "utf8");
      // Must be a Client Component (Next 15 requirement for error.tsx)
      expect(source).toMatch(/^"use client"/m);
      // Must re-export the shared boundary so the rendered UI stays
      // consistent + i18n keys are centralised.
      expect(source).toMatch(/from "@\/components\/common"/);
      expect(source).toMatch(/<ErrorBoundary[\s\S]*?\/>/);
      expect(source).toMatch(/scope=/);
    }
  );

  it("ErrorBoundary is exported from @/components/common and uses the canonical i18n namespace", () => {
    const indexSource = readFileSync(
      resolve(APP_ROOT, "../../../components/common/index.ts"),
      "utf8"
    );
    expect(indexSource).toMatch(/export \{ ErrorBoundary/);

    const ebSource = readFileSync(
      resolve(APP_ROOT, "../../../components/common/ErrorBoundary.tsx"),
      "utf8"
    );
    expect(ebSource).toMatch(/^"use client"/m);
    expect(ebSource).toMatch(/useTranslations\("common\.error"\)/);
    // The 4 canonical i18n keys ErrorBoundary reads.
    for (const key of ["title", "body", "retry", "backHome"]) {
      expect(ebSource).toMatch(new RegExp(`t\\("${key}"\\)`));
    }
  });
});

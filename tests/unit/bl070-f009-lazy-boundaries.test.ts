/**
 * BL-070-F009 — fidelity guard for next/dynamic chunk-split boundaries.
 *
 * Acceptance (spec §F009): 4 IA routes split heavy client bundles via
 * next/dynamic / server-side `await import()` so non-active branches
 * don't ship their JS on first paint. This file pins the structural
 * contract — wrappers exist, page.tsx imports the wrapper rather than
 * the raw client component, and tab-conditional branches use server-
 * side dynamic import().
 *
 * Same source-grep approach as the BL-065 fidelity tests (avoids the
 * async-server-component render cost in vitest).
 */
import { readFileSync } from "fs";
import { resolve } from "path";

import { describe, expect, it } from "vitest";

const APP = resolve(__dirname, "../../src/app/[locale]/(app)");

function read(relative: string): string {
  return readFileSync(resolve(APP, relative), "utf8");
}

describe("BL-070-F009 lazy boundaries (next/dynamic chunk-split)", () => {
  describe("/reach — OutreachComposer dynamic ssr:false", () => {
    it("page.tsx imports the lazy wrapper, not the raw composer", () => {
      const page = read("reach/page.tsx");
      expect(page).toMatch(
        /import \{ OutreachComposerLazy \} from "\.\/OutreachComposerLazy";/,
      );
      expect(page).toMatch(/<OutreachComposerLazy\b/);
      // The raw composer should not be statically imported anywhere in
      // page.tsx (the lazy wrapper is the only entry point).
      expect(page).not.toMatch(
        /import \{ OutreachComposer \} from "\.\/OutreachComposer";/,
      );
    });

    it("OutreachComposerLazy.tsx gates the bundle behind dynamic({ssr:false})", () => {
      const wrapper = read("reach/OutreachComposerLazy.tsx");
      expect(wrapper).toMatch(/"use client";/);
      expect(wrapper).toMatch(/import dynamic from "next\/dynamic"/);
      expect(wrapper).toMatch(/ssr:\s*false/);
      expect(wrapper).toMatch(/loading:\s*\(\)\s*=>/);
      expect(wrapper).toMatch(/import\(.*OutreachComposer/);
    });
  });

  describe("/match — MatchKolTable + MatchRefineBar + AiSuggestionsSidebar split", () => {
    it("page.tsx imports MatchKolTableLazy + MatchRefineBarLazy via wrappers", () => {
      const page = read("match/page.tsx");
      expect(page).toMatch(
        /import \{ MatchKolTableLazy \} from "\.\/MatchKolTableLazy";/,
      );
      expect(page).toMatch(
        /import \{ MatchRefineBarLazy \} from "\.\/MatchRefineBarLazy";/,
      );
      expect(page).toMatch(/<MatchKolTableLazy\b/);
      expect(page).toMatch(/<MatchRefineBarLazy\b/);
      // Raw client imports should be gone — the lazy wrappers are the
      // only entry points for the table and refine bar bundles.
      expect(page).not.toMatch(
        /import \{ MatchKolTable \} from "\.\/MatchKolTable";/,
      );
      expect(page).not.toMatch(
        /import \{ MatchRefineBar \} from "\.\/MatchRefineBar";/,
      );
    });

    it("MatchKolTableLazy + MatchRefineBarLazy each wrap dynamic({ssr:false})", () => {
      for (const file of ["match/MatchKolTableLazy.tsx", "match/MatchRefineBarLazy.tsx"]) {
        const wrapper = read(file);
        expect(wrapper, `${file} use client`).toMatch(/"use client";/);
        expect(wrapper, `${file} dynamic import`).toMatch(
          /import dynamic from "next\/dynamic"/,
        );
        expect(wrapper, `${file} ssr false`).toMatch(/ssr:\s*false/);
        expect(wrapper, `${file} loading skeleton`).toMatch(/loading:\s*\(\)\s*=>/);
      }
    });

    it("page.tsx routes AiSuggestionsSidebar through a server-side `await import()`", () => {
      const page = read("match/page.tsx");
      // No static import of AiSuggestionsSidebar anywhere in page.tsx.
      expect(page).not.toMatch(
        /^import \{ AiSuggestionsSidebar \} from "\.\/AiSuggestionsSidebar";/m,
      );
      // The async helper `AiSidebarColumn` resolves the chunk via
      // `await import("./AiSuggestionsSidebar")` so the no-campaign
      // /match path never fetches it.
      expect(page).toMatch(
        /await import\("\.\/AiSuggestionsSidebar"\)/,
      );
    });
  });

  describe("/brief — tab-conditional `await import()`", () => {
    it("page.tsx no longer statically imports BriefPageClient / ProductListPanel", () => {
      const page = read("brief/page.tsx");
      expect(page).not.toMatch(
        /^import \{ BriefPageClient \} from "\.\/BriefPageClient";/m,
      );
      expect(page).not.toMatch(
        /^import \{ ProductListPanel \} from "\.\/ProductListPanel";/m,
      );
    });

    it("page.tsx routes each tab branch through a server `await import()`", () => {
      const page = read("brief/page.tsx");
      expect(page).toMatch(/await import\("\.\/ProductListPanel"\)/);
      expect(page).toMatch(/await import\("\.\/BriefPageClient"\)/);
    });
  });

  describe("/insight — tab=dashboard `await import()`", () => {
    it("page.tsx no longer statically imports DashboardContent", () => {
      const page = read("insight/page.tsx");
      expect(page).not.toMatch(
        /^import \{ DashboardContent \} from "@\/features\/dashboard\/DashboardContent";/m,
      );
    });

    it("page.tsx loads DashboardContent only inside the dashboard-tab branch", () => {
      const page = read("insight/page.tsx");
      expect(page).toMatch(
        /await import\(\s*"@\/features\/dashboard\/DashboardContent"\s*\)/,
      );
      expect(page).toMatch(/tab === "dashboard"/);
    });
  });
});

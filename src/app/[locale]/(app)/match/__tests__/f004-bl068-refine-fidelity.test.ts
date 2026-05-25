/**
 * BL-068-F004 · Source-level fidelity guards for the /match RefineInputBar
 * integration.
 *
 * The page.tsx wiring (mount inside showAiSidebar branch, refine label
 * bundle reuse from campaigns.detail.refine.*, productId added to the
 * campaign findFirst select) is structural and translates cleanly into
 * static greps — same approach the other f00X-fidelity files take to
 * avoid the async-server-component render cost in vitest.
 */
import { readFileSync } from "fs";
import { resolve } from "path";

import { describe, expect, it } from "vitest";

const MATCH_DIR = resolve(__dirname, "..");

function read(relative: string): string {
  return readFileSync(resolve(MATCH_DIR, relative), "utf8");
}

describe("/match RefineInputBar — F004 BL-068 wiring", () => {
  it("page.tsx imports MatchRefineBar via the F009 lazy wrapper", () => {
    const page = read("page.tsx");
    // BL-070-F009 — MatchRefineBar is now lazy-loaded via
    // MatchRefineBarLazy.tsx (client wrapper + next/dynamic ssr:false).
    // The wrapper file itself still imports the real component.
    expect(page).toMatch(
      /import \{ MatchRefineBarLazy \} from "\.\/MatchRefineBarLazy";/,
    );
    const wrapper = read("MatchRefineBarLazy.tsx");
    expect(wrapper).toMatch(/import\(.*\/MatchRefineBar.*\)/);
    expect(wrapper).toMatch(/m\.MatchRefineBar/);
  });

  it("page.tsx mounts MatchRefineBar(Lazy) inside the showAiSidebar branch (so non-?campaignId mode does not render it)", () => {
    const page = read("page.tsx");
    // Mount is gated by `showAiSidebar && campaign` — the same gate the
    // AiSuggestionsSidebar uses. F009 routed the two through the
    // AiSidebarColumn helper but the gate + relative order are preserved.
    expect(page).toMatch(/<MatchRefineBarLazy\b/);
    expect(page).toMatch(/showAiSidebar && campaign \?/);
    // The mount must precede AiSuggestionsSidebar in the AiSidebarColumn
    // helper (refine bar on top per spec §F004).
    const refineIdx = page.indexOf("<MatchRefineBarLazy");
    const sidebarIdx = page.indexOf("<AiSuggestionsSidebar");
    expect(refineIdx).toBeGreaterThanOrEqual(0);
    expect(sidebarIdx).toBeGreaterThan(refineIdx);
  });

  it("page.tsx passes productId from the campaign query (deletion handling lives client-side)", () => {
    const page = read("page.tsx");
    // The findFirst select picks productId so MatchRefineBar can fall
    // back to /api/kols/smart-match when the pool cache is cold.
    expect(page).toMatch(/select:\s*\{[^}]*productId:\s*true/);
    expect(page).toMatch(/productId=\{campaign\.productId\s*\?\?\s*null\}/);
  });

  it("page.tsx reuses campaigns.detail.refine.* labels (no new /match-scoped i18n keys per F004 spec)", () => {
    const page = read("page.tsx");
    expect(page).toMatch(/getTranslations\("campaigns\.detail\.refine"\)/);
    for (const key of [
      "inputPlaceholder",
      "applyButton",
      "resetButton",
      "loading",
      "feedbackPrefix",
      "unparsableToast",
      "capExhaustedToast",
      "networkError",
      "permutationInvalid",
    ]) {
      expect(
        page.includes(`tRefine("${key}")`),
        `page.tsx missing tRefine("${key}") wiring`,
      ).toBe(true);
    }
  });

  it("MatchRefineBar imports the shared refine-cache helpers (cross-page key reused)", () => {
    const bar = read("MatchRefineBar.tsx");
    expect(bar).toMatch(/from "@\/lib\/refine-cache"/);
    expect(bar).toMatch(/refineCacheKey/);
    expect(bar).toMatch(/readRefineCache/);
    expect(bar).toMatch(/writeRefineCache/);
    expect(bar).toMatch(/clearRefineCache/);
  });

  it("MatchRefineBar reuses the F003 RefineInputBar component (no new component built)", () => {
    const bar = read("MatchRefineBar.tsx");
    expect(bar).toMatch(
      /import \{[\s\S]*?RefineInputBar[\s\S]*?\} from "@\/app\/\[locale\]\/\(app\)\/campaigns\/\[id\]\/RefineInputBar"/,
    );
    expect(bar).toMatch(/<RefineInputBar\b/);
  });
});

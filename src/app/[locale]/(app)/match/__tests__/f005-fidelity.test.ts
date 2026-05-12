/**
 * BL-065-F005 · Source-level fidelity guards for the AI suggestions
 * sidebar upgrade.
 *
 * F001 shipped AiSuggestionsSidebar as a placeholder shell; F005
 * upgrades it to wrap the BM2 AiSuggestionsClient with campaign-context
 * labels + the C2 "why" placeholder. Static greps cover the contract
 * efficiently — same pattern as F002 / F003 / F004 fidelity tests.
 */
import { readFileSync } from "fs";
import { resolve } from "path";

import { describe, expect, it } from "vitest";

const MATCH_DIR = resolve(__dirname, "..");

function read(relative: string): string {
  return readFileSync(resolve(MATCH_DIR, relative), "utf8");
}

describe("/match AI sidebar — F005 upgrade (BL-065-F005)", () => {
  it("AiSuggestionsSidebar wraps the BM2 AiSuggestionsClient verbatim", () => {
    const sidebar = read("AiSuggestionsSidebar.tsx");
    expect(sidebar).toMatch(
      /import \{ AiSuggestionsClient \} from "@\/app\/\[locale\]\/\(app\)\/campaigns\/\[id\]\/AiSuggestionsClient"/,
    );
    expect(sidebar).toMatch(/<AiSuggestionsClient\b/);
    // The full BM2 labels bundle (campaigns.detail.insights.ai.*)
    // gets passed through — no copy duplicated in match.aiSidebar.
    for (const key of [
      "generateCta",
      "refreshCta",
      "loading",
      "cachedPrefix",
      "empty",
      "error",
    ]) {
      expect(
        sidebar.includes(`tAi("${key}")`),
        `AiSuggestionsSidebar missing tAi("${key}") wiring`,
      ).toBe(true);
    }
  });

  it("sidebar header surfaces the resolved campaign name + C2 why hint", () => {
    const sidebar = read("AiSuggestionsSidebar.tsx");
    expect(sidebar).toMatch(
      /data-testid="match-ai-sidebar-campaign-name"/,
    );
    expect(sidebar).toMatch(/data-testid="match-ai-sidebar-why-hint"/);
    expect(sidebar).toMatch(/t\("withCampaign", \{ name: campaignName \}\)/);
    expect(sidebar).toMatch(/t\("whyHint"\)/);
  });

  it("F001 placeholder + shellTag content is gone (no half-baked copy left)", () => {
    const sidebar = read("AiSuggestionsSidebar.tsx");
    // F001 rendered a placeholder paragraph + a yellow "F005 — wires
    // up..." shellTag chip. Both must be retired now that F005 wires
    // the real client. Drop the testid + the i18n key references.
    expect(sidebar).not.toMatch(/match-ai-sidebar-shell-tag/);
    expect(sidebar).not.toMatch(/t\("placeholder"\)/);
    expect(sidebar).not.toMatch(/t\("shellTag"\)/);
  });

  it("AiSuggestionsSidebar now requires tenantId / locale / campaignName props", () => {
    const sidebar = read("AiSuggestionsSidebar.tsx");
    // F001 took only campaignId; F005 needs the full trio so the
    // embedded client can run + the header can render.
    expect(sidebar).toMatch(/campaignId: string;/);
    expect(sidebar).toMatch(/tenantId: string;/);
    expect(sidebar).toMatch(/locale: string;/);
    expect(sidebar).toMatch(/campaignName: string;/);
  });
});

describe("/match page wires the AI sidebar tenant-scoped (BL-065-F005)", () => {
  it("page.tsx looks up the campaign tenant-scoped (id + name only)", () => {
    const page = read("page.tsx");
    // The findFirst lives inside withTenant(tenantId, …) so RLS strips
    // foreign-tenant rows even before the JS check.
    expect(page).toMatch(/tx\.campaign\.findFirst\(/);
    expect(page).toMatch(/where: \{ id: campaignId, deletedAt: null \}/);
    expect(page).toMatch(/select: \{ id: true, name: true \}/);
  });

  it("sidebar is only rendered when the campaign resolves (not just when ?campaignId is set)", () => {
    const page = read("page.tsx");
    expect(page).toMatch(/const showAiSidebar = Boolean\(campaign\);/);
    // The render guard checks the resolved object, not the raw URL.
    expect(page).toMatch(/showAiSidebar && campaign \? \(/);
    // grid columns + the data-campaign-mode attribute both reflect
    // the resolved state — a stale ?campaignId= must NOT widen the
    // workbench to 3 columns.
    expect(page).toMatch(/data-campaign-mode=\{showAiSidebar/);
  });

  it("page.tsx threads tenantId + locale + campaignName through to the sidebar", () => {
    const page = read("page.tsx");
    expect(page).toMatch(/<AiSuggestionsSidebar\b/);
    expect(page).toMatch(/tenantId=\{tenantId\}/);
    expect(page).toMatch(/locale=\{locale\}/);
    expect(page).toMatch(/campaignName=\{campaign\.name\}/);
  });
});

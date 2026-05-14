/**
 * BL-066-F002 · Source-level fidelity guards for /campaigns/:id rewrite.
 *
 * Static greps over the [id] folder. Now locks the three-section
 * AI-native layout (Brief / AiRecommendation / KOL panel) per F002
 * audit §裁决 #5=C (底部 CampaignKolPanel 沿用; F006 才 git mv).
 * Original 2-col + 3 Insights cards layout was BM2-F005 / MVP-vf-F005;
 * those four sidebar/inline components are unmount-only (files kept
 * with @deprecated_by_BL-066 marker for BL-070 atomic delete).
 */
import { readFileSync } from "fs";
import { resolve } from "path";

import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "..");

function read(relative: string): string {
  return readFileSync(resolve(ROOT, relative), "utf8");
}

function lineCount(s: string): number {
  return s.split("\n").length;
}

describe("/campaigns/:id fidelity guards (BL-066 F002)", () => {
  it("page wires the three-section AI-native layout", () => {
    const page = read("page.tsx");
    expect(page).toMatch(/<BriefSummaryPanel\b/);
    expect(page).toMatch(/<AiRecommendationPanel\b/);
    expect(page).toMatch(/<CampaignKolPanel\b/);
  });

  it("page no longer mounts BM2-F005 sidebar / inline components", () => {
    const page = read("page.tsx");
    expect(page).not.toMatch(/<CampaignHealthCard\b/);
    expect(page).not.toMatch(/<AiSuggestionsCard\b/);
    expect(page).not.toMatch(/<ActivityTimelineCard\b/);
    expect(page).not.toMatch(/<EmailPerformanceChart\b/);
    expect(page).not.toMatch(/<CampaignRevenueRecorder\b/);
    expect(page).not.toMatch(/<CampaignStatusController\b/);
    expect(page).not.toMatch(/<CampaignHeader\b/);
  });

  it("the 6 unmount component files carry @deprecated_by_BL-066 marker", () => {
    for (const f of [
      "CampaignHealthCard.tsx",
      "ActivityTimelineCard.tsx",
      "EmailPerformanceChart.tsx",
      "EmailPerformanceChartImpl.tsx",
      "CampaignRevenueRecorder.tsx",
      "CampaignStatusController.tsx",
    ]) {
      expect(read(f), f).toMatch(/@deprecated_by_BL-066/);
    }
  });

  it("CampaignKolPanel slimmed to <= 250 lines", () => {
    const panel = read("CampaignKolPanel.tsx");
    expect(lineCount(panel)).toBeLessThanOrEqual(250);
  });

  // BL-066-F005: AddKolDialog.tsx deleted (AI recommendation flow
  // replaces manual add). Original guard read the file and asserted the
  // public <Dialog> atom + no manual ARIA — moot once the file is gone.

  it("CampaignHeader drops INPUT_CLASS local and uses <Input> + <Button>", () => {
    const hdr = read("CampaignHeader.tsx");
    expect(hdr).not.toMatch(/^const INPUT_CLASS/m);
    expect(hdr).toMatch(/from "@\/components\/ui"/);
  });

  it("AI Suggestions card uses client generator flow (no disabled Run AI match ghost control)", () => {
    const card = read("AiSuggestionsCard.tsx");
    expect(card).toMatch(/<AiSuggestionsClient\b/);
    expect(card).toMatch(/generateCta/);
    expect(card).toMatch(/refreshCta/);
    expect(card).not.toMatch(/campaign-ai-run-match/);
    expect(card).not.toMatch(/runMatchTooltip/);
  });

  it("CampaignKolRow uses <Select>/<Input>/<TCell> from the public ui atoms", () => {
    const row = read("CampaignKolRow.tsx");
    expect(row).toMatch(/from "@\/components\/ui"/);
    expect(row).toMatch(/<Select\b/);
    expect(row).toMatch(/<Input\b/);
    expect(row).toMatch(/<TRow\b/);
  });

  it("page.tsx never passes function props across the RSC boundary", () => {
    const page = read("page.tsx");
    // Permit `(t, ...) => <obj>` helper functions OUTSIDE JSX (label
    // assemblers); reject closure props nested inside JSX attributes.
    // JSX prop pattern is `<Identifier>: ( ... ) => <something>` —
    // tighten by requiring the colon-space-paren shape preceded by
    // whitespace inside a known prop-like context.
    expect(page).not.toMatch(/<[A-Z][a-zA-Z]*[\s\S]*?[a-z]+:\s*\([^)]*\)\s*=>\s*[^,{}]/);
  });
});

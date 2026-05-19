/**
 * BL-066-F002 + F006 · Source-level fidelity guards for /campaigns/:id.
 *
 * Static greps over the [id] folder. Locks the three-section AI-native
 * layout (Brief / AiRecommendation / AcceptedKolsPanel) — after F006
 * the bottom panel is renamed and rendered read-only with a source
 * chip column. Original 2-col + 3 Insights cards layout was BM2-F005
 * / MVP-vf-F005; BL-070-F005 二次清理 deleted the 6 unmount files
 * outright. The negative-mount guard below stays so a regression that
 * re-introduces any of those components surfaces here.
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

describe("/campaigns/:id fidelity guards (BL-066 F002 + F006)", () => {
  it("page wires the three-section AI-native layout", () => {
    const page = read("page.tsx");
    expect(page).toMatch(/<BriefSummaryPanel\b/);
    expect(page).toMatch(/<AiRecommendationPanel\b/);
    expect(page).toMatch(/<AcceptedKolsPanel\b/);
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

  it("BL-070-F005 二次清理 — the 6 BL-066 unmount component files are gone", () => {
    // Files were git rm'd in F005; this regression guard catches an
    // accidental re-add by asserting their source paths do not resolve.
    // Lives here (not as a filesystem grep) so it stays adjacent to the
    // page.tsx negative-mount guard above for easy review.
    for (const f of [
      "CampaignHealthCard.tsx",
      "ActivityTimelineCard.tsx",
      "EmailPerformanceChart.tsx",
      "EmailPerformanceChartImpl.tsx",
      "CampaignRevenueRecorder.tsx",
      "CampaignStatusController.tsx",
    ]) {
      expect(
        () => read(f),
        `${f} must NOT exist (BL-070-F005 deleted it)`,
      ).toThrow();
    }
  });

  it("AcceptedKolsPanel slimmed to <= 250 lines", () => {
    const panel = read("AcceptedKolsPanel.tsx");
    expect(lineCount(panel)).toBeLessThanOrEqual(250);
  });

  it("AcceptedKolsPanel filters kol_campaign rows to the source whitelist", () => {
    const panel = read("AcceptedKolsPanel.tsx");
    // BL-066-F006: spec §F006 #C locks the whitelist; the backfill
    // migration moves pre-F004 'manual' rows into 'manual_legacy' so
    // the three values below cover every visible row.
    expect(panel).toMatch(/ai_smart_match/);
    expect(panel).toMatch(/csv_import/);
    expect(panel).toMatch(/manual_legacy/);
  });

  it("AcceptedKolRow exposes a source chip and renders the status / fee read-only", () => {
    const row = read("AcceptedKolRow.tsx");
    // Source chip column is the F006 anchor — independent column,
    // not inlined into the creator cell (per F006 audit §裁决 #4=A).
    expect(row).toMatch(/accepted-kol-source-chip/);
    expect(row).toMatch(/sourceChipLabels/);
    // Status / fee cells are read-only after F006 — no <Select> /
    // <Input> mutation surfaces (those were removed alongside the
    // manual-edit entries).
    expect(row).not.toMatch(/<Select\b/);
    expect(row).not.toMatch(/<Input\b/);
    // View-profile link is the only action — deep links into the
    // KOL detail page; remove button was retired with the edit
    // surfaces.
    expect(row).toMatch(/accepted-kol-view-profile/);
    expect(row).not.toMatch(/campaign-kol-remove/);
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

  it("AcceptedKolRow uses <TCell>/<TRow> from the public ui atoms", () => {
    const row = read("AcceptedKolRow.tsx");
    expect(row).toMatch(/from "@\/components\/ui"/);
    expect(row).toMatch(/<TRow\b/);
    expect(row).toMatch(/<TCell\b/);
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

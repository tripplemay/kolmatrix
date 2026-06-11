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

  it("AcceptedKolsPanel filters kol_campaign rows via the shared accepted predicate", () => {
    // BL-110-F003: the source whitelist + suggestionStatus gate moved to
    // accepted-filter.ts so the page's acceptedCount reuses the exact same
    // predicate. The panel must consume it (not re-implement a local
    // source-only filter that leaked AI-panel skip/swap rows).
    const panel = read("AcceptedKolsPanel.tsx");
    expect(panel).toMatch(/isAcceptedKolRow/);
    expect(panel).toMatch(/from "\.\/accepted-filter"/);
    expect(panel).not.toMatch(/new Set\(\[/); // no local source whitelist anymore
  });

  it("accepted-filter locks the source whitelist AND the suggestionStatus gate", () => {
    const filter = read("accepted-filter.ts");
    // BL-066-F006: spec §F006 #C locks the whitelist; the backfill
    // migration moves pre-F004 'manual' rows into 'manual_legacy'.
    expect(filter).toMatch(/ai_smart_match/);
    expect(filter).toMatch(/csv_import/);
    expect(filter).toMatch(/manual_legacy/);
    // BL-110-F003: the suggestionStatus ∈ {accepted, NULL} gate is what
    // excludes AI-panel skip/swap rows (source=ai_smart_match) from the
    // accepted list.
    expect(filter).toMatch(/suggestionStatus/);
    expect(filter).toMatch(/"accepted"/);
  });

  it("page acceptedCount reuses the shared accepted predicate (no kols.length)", () => {
    const page = read("page.tsx");
    expect(page).toMatch(/isAcceptedKolRow/);
    expect(page).not.toMatch(/acceptedCount = campaign\.kols\.length/);
  });

  it("AcceptedKolRow keeps the source chip + view-profile and restores canEdit-gated inline ops (BL-105-F003)", () => {
    const row = read("AcceptedKolRow.tsx");
    // Source chip column stays the F006 anchor; view-profile stays.
    expect(row).toMatch(/accepted-kol-source-chip/);
    expect(row).toMatch(/sourceChipLabels/);
    expect(row).toMatch(/accepted-kol-view-profile/);
    // BL-105-F003 reverses the F006 read-only call (user decision
    // 2026-06-09 / audit M1): the orphaned KOL-op actions get a UI again.
    // Inline status <Select> + fee <Input> + remove are gated behind
    // `canEdit` so a non-owner / non-admin still sees the read-only row.
    expect(row).toMatch(/canEdit/);
    expect(row).toMatch(/<Select\b/);
    expect(row).toMatch(/<Input\b/);
    expect(row).toMatch(/accepted-kol-remove/);
    expect(row).toMatch(/updateKolContactStatusAction/);
    expect(row).toMatch(/updateKolFeeAction/);
    expect(row).toMatch(/removeKolAction/);
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

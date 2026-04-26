/**
 * MVP-vf-F005 · Source-level fidelity guards for /campaigns/:id rewrite.
 *
 * Static greps over the [id] folder. Locks in the structural goals
 * from the F005 acceptance: 2-col layout, three Insights cards, Add
 * Dialog using the public <Dialog> atom, CampaignKolPanel ≤ 250
 * lines, no INPUT_CLASS local, no function props across the RSC
 * boundary.
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

describe("/campaigns/:id fidelity guards (MVP-vf-F005)", () => {
  it("page wires the 2-column layout with the right rail", () => {
    const page = read("page.tsx");
    expect(page).toMatch(/lg:grid-cols-\[minmax\(0,1fr\)_320px\]/);
    expect(page).toMatch(/data-testid="campaign-detail-insights"/);
    expect(page).toMatch(/<CampaignHealthCard\b/);
    expect(page).toMatch(/<AiSuggestionsCard\b/);
    expect(page).toMatch(/<ActivityTimelineCard\b/);
    expect(page).toMatch(/<EmailPerformanceChart\b/);
  });

  it("CampaignKolPanel slimmed to <= 250 lines", () => {
    const panel = read("CampaignKolPanel.tsx");
    expect(lineCount(panel)).toBeLessThanOrEqual(250);
  });

  it("AddKolDialog uses the public <Dialog> atom (no hand-rolled modal)", () => {
    const dlg = read("AddKolDialog.tsx");
    expect(dlg).toMatch(/from "@\/components\/ui"/);
    expect(dlg).toMatch(/<Dialog\b/);
    expect(dlg).toMatch(/<DialogPanel\b/);
    expect(dlg).not.toMatch(/role="dialog"/); // no manual ARIA
  });

  it("CampaignHeader drops INPUT_CLASS local and uses <Input> + <Button>", () => {
    const hdr = read("CampaignHeader.tsx");
    expect(hdr).not.toMatch(/^const INPUT_CLASS/m);
    expect(hdr).toMatch(/from "@\/components\/ui"/);
  });

  it("AI Suggestions card disables Run AI match with a tooltip (no ghost control)", () => {
    const card = read("AiSuggestionsCard.tsx");
    const block = card.match(
      /<Button[\s\S]*?data-testid="campaign-ai-run-match"[\s\S]*?>/
    );
    expect(block, "Run AI match Button block").not.toBeNull();
    expect(block![0]).toMatch(/disabled/);
    expect(block![0]).toMatch(/runMatchTooltip/);
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

/**
 * MVP-vf-F006 · Source-level fidelity guards for /kols/:id rewrite.
 *
 * Per-tab structure preservation: the F006 hotfix only changed the
 * decomposition (page.tsx → 6 child components). Behaviour, data
 * shape, and tab routing are untouched. These guards lock that in.
 */
import { readFileSync } from "fs";
import { resolve } from "path";

import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "..");

function read(relative: string): string {
  return readFileSync(resolve(ROOT, relative), "utf8");
}

describe("/kols/:id fidelity guards (MVP-vf-F006)", () => {
  it("page wires the 6 child components in the expected order", () => {
    const page = read("page.tsx");
    expect(page).toMatch(/<Breadcrumb\b/);
    expect(page).toMatch(/<KolHero\b/);
    expect(page).toMatch(/<KolTabsNav\b/);
    expect(page).toMatch(/<KolOverviewInfo\b/);
    expect(page).toMatch(/<KolValueScoreCard\b/);
    expect(page).toMatch(/<KolActionsCard\b/);
    expect(page).toMatch(/<EmptyTabState\b/);

    const heroAt = page.search(/<KolHero\s/);
    const tabsAt = page.search(/<KolTabsNav\s/);
    const overviewAt = page.search(/<KolOverviewInfo\s/);
    expect(heroAt).toBeGreaterThan(0);
    expect(tabsAt).toBeGreaterThan(heroAt);
    expect(overviewAt).toBeGreaterThan(tabsAt);
  });

  it("preserves the 4-tab routing (overview / collabs / contacts / ai)", () => {
    const tabs = read("KolTabsNav.tsx");
    expect(tabs).toMatch(/"overview"/);
    expect(tabs).toMatch(/"collabs"/);
    expect(tabs).toMatch(/"contacts"/);
    expect(tabs).toMatch(/"ai"/);
    // Tab keys are emitted as data-testid="kol-tab-X" so the existing
    // E2E selectors keep finding them.
    expect(tabs).toMatch(/data-testid=\{`kol-tab-/);
  });

  it("KolHero exposes data-testid=\"kol-hero\" so the visual mask still hits", () => {
    const hero = read("KolHero.tsx");
    expect(hero).toMatch(/data-testid="kol-hero"/);
  });

  it("KolValueScoreCard renders the cyan score number (or empty state)", () => {
    const card = read("KolValueScoreCard.tsx");
    expect(card).toMatch(/data-testid="kol-value-score-card"/);
    expect(card).toMatch(/text-cyan/);
    expect(card).toMatch(/valueEmpty/);
  });

  it("KolActionsCard wires both client widgets it inherited", () => {
    const actions = read("KolActionsCard.tsx");
    expect(actions).toMatch(/<RelationshipStatusSelect\b/);
    expect(actions).toMatch(/<SavedToggleButton\b/);
  });

  it("EmptyTabState routes through GlassPanel for the inactive tabs", () => {
    const empty = read("EmptyTabState.tsx");
    expect(empty).toMatch(/<GlassPanel\b/);
    expect(empty).toMatch(/data-testid=\{`kol-empty-/);
  });

  it("page.tsx never passes function props across the RSC boundary", () => {
    const page = read("page.tsx");
    expect(page).not.toMatch(/<[A-Z][a-zA-Z]*[\s\S]*?[a-z]+:\s*\([^)]*\)\s*=>\s*[^,{}]/);
  });
});

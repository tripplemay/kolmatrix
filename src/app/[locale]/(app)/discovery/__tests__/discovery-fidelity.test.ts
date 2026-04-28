/**
 * MVP-vf-F002 · Source-level fidelity guards for /discovery rewrite.
 *
 * These tests don't render — they static-grep the discovery folder and
 * fail if a Stitch-required element regresses. Cheaper than an E2E
 * round-trip, and they guard exactly the regressions that motivated
 * the hotfix in the first place: ghost controls, simplified prototype
 * sections, and pre-hotfix INPUT_CLASS / CHIP_BASE dead patterns.
 */
import { readFileSync } from "fs";
import { resolve } from "path";

import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "..");

function read(relative: string): string {
  return readFileSync(resolve(ROOT, relative), "utf8");
}

describe("/discovery fidelity guards (MVP-vf-F002)", () => {
  it("page mounts the SmartMatchDialog (B7a-F002) — disabled placeholder is gone", () => {
    const page = read("page.tsx");
    expect(page).toMatch(/<SmartMatchDialog /);
    // The dialog itself owns the data-testid="ai-smart-match-button"
    // — assert it lives in the client component, not back in page.tsx.
    expect(page).not.toMatch(/aiSmartMatchTooltip/);
    const dialog = read("SmartMatchDialog.tsx");
    expect(dialog).toMatch(/data-testid="ai-smart-match-button"/);
    expect(dialog).toMatch(/data-testid="smart-match-dialog"/);
  });

  it("page renders the Save Search placeholder with a tooltip (no ghost control)", () => {
    const page = read("page.tsx");
    expect(page).toMatch(/data-testid="save-search-button"/);
    expect(page).toMatch(/saveSearchTooltip/);
    // Must be disabled — Save Search is not real until B7b.
    // Look for the disabled attribute inside the same JSX element as
    // the save-search testid (Button block spans ~7 lines).
    expect(page).toMatch(
      /<Button[\s\S]{0,500}disabled[\s\S]{0,500}data-testid="save-search-button"/
    );
  });

  it("page renders the SearchBar above the filter+grid layout", () => {
    const page = read("page.tsx");
    expect(page).toMatch(/<SearchBar /);
    // Must come before the lg:grid-cols line that hosts the sidebar.
    const searchAt = page.indexOf("<SearchBar");
    const gridAt = page.indexOf("lg:grid-cols-[260px");
    expect(searchAt).toBeGreaterThan(0);
    expect(gridAt).toBeGreaterThan(searchAt);
  });

  it("page restores xl:grid-cols-4 (not the old 3) for the result grid", () => {
    const page = read("page.tsx");
    expect(page).toMatch(/xl:grid-cols-4/);
    expect(page).not.toMatch(/xl:grid-cols-3/);
  });

  it("ActiveFilters surfaces and clears every chip via URL navigation", () => {
    const af = read("ActiveFilters.tsx");
    expect(af).toMatch(/data-testid="discovery-active-filters"/);
    expect(af).toMatch(/data-testid={`active-filter-chip-/);
    expect(af).toMatch(/serializeFilters\(filters, chip\.clear\)/);
  });

  it("SearchBar exposes platform selector and AI suggestion chips", () => {
    const sb = read("SearchBar.tsx");
    expect(sb).toMatch(/data-testid="search-platform-select"/);
    expect(sb).toMatch(/data-testid="search-main-input"/);
    expect(sb).toMatch(/data-testid={`ai-chip-/);
  });

  it("SummaryBar renders sort + grid/list view toggle", () => {
    const sb = read("SummaryBar.tsx");
    expect(sb).toMatch(/data-testid="discovery-view-toggle"/);
    expect(sb).toMatch(/data-testid={`view-/);
    expect(sb).toMatch(/data-testid={`sort-/);
  });

  it("FilterSidebar no longer references the legacy INPUT_CLASS/CHIP_BASE locals", () => {
    const fs = read("FilterSidebar.tsx");
    // Doc comment refs are allowed — the constants themselves must be gone.
    expect(fs).not.toMatch(/^const INPUT_CLASS/m);
    expect(fs).not.toMatch(/^const CHIP_BASE/m);
    expect(fs).toMatch(/from "@\/components\/ui"/);
  });
});

/**
 * MVP-vf-F003 · Source-level fidelity guards for the /database rewrite.
 *
 * Static greps over the database folder. Cheaper than a full E2E for
 * the regressions that motivated the hotfix: ghost controls, missing
 * Stitch sections, INPUT_CLASS dead code.
 */
import { readFileSync } from "fs";
import { resolve } from "path";

import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "..");

function read(relative: string): string {
  return readFileSync(resolve(ROOT, relative), "utf8");
}

describe("/database fidelity guards (MVP-vf-F003)", () => {
  it("renders the QuickStats KPI strip and InsightsPanel above the fold", () => {
    const page = read("page.tsx");
    expect(page).toMatch(/<QuickStats /);
    expect(page).toMatch(/<InsightsPanel /);
    // QuickStats must come before the table in JSX order for the
    // layout to match Stitch. Find the FIRST `<QuickStats stats=` JSX
    // tag (skipping the import line) and compare to the JSX tag for
    // <DatabaseTableClient rows=.
    const quickJsx = page.indexOf("<QuickStats stats");
    // Find the JSX use of DatabaseTableClient (props on the next line)
    // rather than the import statement on line 1.
    const tableJsx = page.search(/<DatabaseTableClient\s+rows=/);
    expect(quickJsx).toBeGreaterThan(0);
    expect(tableJsx).toBeGreaterThan(quickJsx);
  });

  it("header CTAs (Export / Import / Add KOL) are disabled with explicit tooltips", () => {
    const page = read("page.tsx");
    // Each CTA Button block must contain `disabled`, the matching
    // tooltip, and the data-testid. Order within JSX props is
    // formatter-dependent, so just check all three tokens live in the
    // same Button element.
    for (const [testid, tooltipKey] of [
      ["database-export", "exportTooltip"],
      ["database-import", "importTooltip"],
      ["database-add-kol", "addKolTooltip"],
    ] as const) {
      const block = page.match(
        new RegExp(`<Button[\\s\\S]*?data-testid="${testid}"[\\s\\S]*?>`)
      );
      expect(block, `Button ${testid} block`).not.toBeNull();
      expect(block![0]).toMatch(/disabled/);
      expect(block![0]).toMatch(new RegExp(`tHeader\\("${tooltipKey}"\\)`));
    }
  });

  it("filter bar drops INPUT_CLASS / CHIP_BASE locals and uses public atoms", () => {
    const fb = read("DatabaseFilterBar.tsx");
    expect(fb).not.toMatch(/^const INPUT_CLASS/m);
    expect(fb).not.toMatch(/^const CHIP_BASE/m);
    expect(fb).toMatch(/from "@\/components\/ui"/);
    expect(fb).toMatch(/from "@\/components\/common"/);
  });

  it("filter bar surfaces the 7 acceptance dims (search/category/region/tier/game/tags + status pills)", () => {
    const fb = read("DatabaseFilterBar.tsx");
    expect(fb).toMatch(/t\("search"\)/);
    expect(fb).toMatch(/t\("category"\)/);
    expect(fb).toMatch(/t\("region"\)/);
    expect(fb).toMatch(/t\("tier"\)/);
    expect(fb).toMatch(/t\("game"\)/);
    expect(fb).toMatch(/t\("tags"\)/);
    expect(fb).toMatch(/data-testid="database-status-pills"/);
  });

  it("Tier and Game placeholders are disabled (no ghost controls)", () => {
    const fb = read("DatabaseFilterBar.tsx");
    // Each placeholder Select must declare `disabled` and a tooltip.
    expect(fb).toMatch(/<Select disabled title=\{t\("comingSoonTooltip"\)\}/);
  });

  it("BulkActionBar wires Add to Campaign to the campaign dialog and disables Email + Delete", () => {
    const bar = read("BulkActionBar.tsx");
    expect(bar).toMatch(/data-testid="bulk-bar-add-to-campaign"/);
    for (const [testid, tooltipKey] of [
      ["bulk-bar-email", "emailTooltip"],
      ["bulk-bar-delete", "deleteTooltip"],
    ] as const) {
      const block = bar.match(
        new RegExp(`<Button[\\s\\S]*?data-testid="${testid}"[\\s\\S]*?>`)
      );
      expect(block, `BulkActionBar ${testid} block`).not.toBeNull();
      expect(block![0]).toMatch(/disabled/);
      // Post-RSC-fix: BulkActionBar reads i18n via `t("...Tooltip")`
      // directly instead of accepting a `labels` prop.
      expect(block![0]).toMatch(new RegExp(`t\\("${tooltipKey}"\\)`));
    }
  });

  it("Add to Campaign dialog points at the new bulk endpoint", () => {
    const dlg = read("AddToCampaignDialog.tsx");
    expect(dlg).toMatch(/POST/);
    expect(dlg).toMatch(/\/api\/campaigns\/\$\{campaignId\}\/kols\/bulk/);
    expect(dlg).toMatch(/JSON\.stringify\(\{ kolIds: selectedIds \}\)/);
  });

  it("InsightsPanel surfaces all three Stitch cards", () => {
    const ip = read("InsightsPanel.tsx");
    expect(ip).toMatch(/aiIntelligenceHeading/);
    expect(ip).toMatch(/coverageGapHeading/);
    expect(ip).toMatch(/engagementHeading/);
  });

  it("table client uses Checkbox indeterminate for the header-row select-all", () => {
    const tc = read("DatabaseTableClient.tsx");
    expect(tc).toMatch(/Checkbox/);
    expect(tc).toMatch(/indeterminate=\{someOnPage\}/);
  });

  it("page.tsx never passes function props to DatabaseTableClient (RSC boundary)", () => {
    // Regression guard for CI run 24960980374: an earlier draft passed
    // `selectRowAria: (name) => tTable(...)` and `body: tDialog("body")`
    // (with an unbound {count} ICU placeholder) across the server →
    // client boundary. Both crashed at render with "Functions are not
    // valid as a React child" / FORMATTING_ERROR. This guard fails if
    // either pattern returns.
    const page = read("page.tsx");
    // Reject any `<Identifier>: (any-args) => …` shape inside a JSX prop.
    expect(page).not.toMatch(/[a-zA-Z]+:\s*\([^)]*\)\s*=>\s*[a-zA-Z]/);
    // The labels objects that previously held those callbacks should
    // be gone — DatabaseTableClient now receives only `rows`, `locale`,
    // `rowFormatted`.
    expect(page).not.toMatch(/cellLabels=\{/);
    expect(page).not.toMatch(/dialogLabels=\{/);
    expect(page).not.toMatch(/bulkLabels=\{/);
  });
});

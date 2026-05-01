/**
 * MVP-vf-F004 · Source-level fidelity guards for /campaigns rewrite.
 *
 * Static greps over the campaigns folder. Same pattern as the
 * /database guards: cheap, fast, and they fail loudly the moment a
 * Stitch section disappears or a ghost control sneaks back in.
 */
import { readFileSync } from "fs";
import { resolve } from "path";

import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "..");

function read(relative: string): string {
  return readFileSync(resolve(ROOT, relative), "utf8");
}

describe("/campaigns fidelity guards (MVP-vf-F004)", () => {
  it("renders the KPI strip + AI suggestions and stitches them in the right order", () => {
    const page = read("page.tsx");
    // Both the JSX use-site and the import line match — accept either,
    // then enforce ordering against the JSX use specifically.
    expect(page).toMatch(/<CampaignsKpiStrip\b/);
    expect(page).toMatch(/<CampaignsFilterBar\b/);
    expect(page).toMatch(/<CampaignsTable\b/);
    expect(page).toMatch(/<AiSuggestionsCard\b/);

    const kpiJsx = page.search(/<CampaignsKpiStrip\s+kpis=/);
    const filterJsx = page.search(/<CampaignsFilterBar\s+filters=/);
    const tableJsx = page.search(/<CampaignsTable\s+rows=/);
    expect(kpiJsx).toBeGreaterThan(0);
    expect(filterJsx).toBeGreaterThan(kpiJsx);
    expect(tableJsx).toBeGreaterThan(filterJsx);
  });

  it("Import button is fully removed — no ghost control remains (F007 polish)", () => {
    const page = read("page.tsx");
    expect(page).not.toMatch(/campaigns-import/);
    expect(page).not.toMatch(/importTooltip/);
  });

  it("filter bar surfaces the 7 acceptance dims (status chips + search + game + region + owner + 2 date)", () => {
    const fb = read("CampaignsFilterBar.tsx");
    expect(fb).toMatch(/data-testid="campaigns-status-chips"/);
    expect(fb).toMatch(/data-testid="campaigns-search-input"/);
    expect(fb).toMatch(/data-testid="campaigns-game-select"/);
    expect(fb).toMatch(/data-testid="campaigns-region-select"/);
    expect(fb).toMatch(/data-testid="campaigns-owner-select"/);
    expect(fb).toMatch(/data-testid="campaigns-date-from"/);
    expect(fb).toMatch(/data-testid="campaigns-date-to"/);
  });

  it("Owner select is disabled in solo-tenant MVP with a tooltip", () => {
    const fb = read("CampaignsFilterBar.tsx");
    // The Owner placeholder must declare disabled + the ownerTooltip
    // key. JSX prop order is formatter-dependent — match the whole
    // <Select> block so we don't care which prop comes first.
    const block = fb.match(/<Select[\s\S]*?data-testid="campaigns-owner-select"[\s\S]*?>/);
    expect(block, "Owner Select block").not.toBeNull();
    expect(block![0]).toMatch(/disabled/);
    expect(block![0]).toMatch(/t\("ownerTooltip"\)/);
  });

  it("filter bar drops INPUT_CLASS local and uses public ui atoms", () => {
    const fb = read("CampaignsFilterBar.tsx");
    expect(fb).not.toMatch(/^const INPUT_CLASS/m);
    expect(fb).toMatch(/from "@\/components\/ui"/);
    expect(fb).toMatch(/from "@\/components\/common"/);
  });

  it("AI Suggestions card hardcodes the /discovery jump per acceptance", () => {
    const card = read("AiSuggestionsCard.tsx");
    expect(card).toMatch(/data-testid="campaigns-ai-suggestions"/);
    expect(card).toMatch(/data-testid="campaigns-ai-suggestions-cta"/);
    expect(card).toMatch(/\/discovery/);
  });

  it("page.tsx never passes function props across the RSC boundary", () => {
    // BM2 F011 / MVP-vf-F003 lesson — closures crash on serialization.
    const page = read("page.tsx");
    expect(page).not.toMatch(/[a-zA-Z]+:\s*\([^)]*\)\s*=>\s*[a-zA-Z]/);
  });
});

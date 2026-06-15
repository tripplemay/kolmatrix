/**
 * BL-117-F002 · PainPoints spec — 4 broad KOL-marketing pain cards (discovery /
 * matching / conversion / compliance) with the spec'd icons.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl/server", () => ({
  getTranslations: async (arg: string | { namespace?: string }) => {
    const namespace = typeof arg === "string" ? arg : (arg?.namespace ?? "");
    return (key: string) => `${namespace}.${key}`;
  },
}));

import { PainPoints } from "../PainPoints";

describe("BL-117-F002 PainPoints (broad)", () => {
  it("renders 4 broad KOL-marketing pain cards with the spec icons", async () => {
    const html = renderToStaticMarkup(await PainPoints());
    expect(html).toContain('data-testid="landing-painpoints"');
    for (const key of ["discovery", "matching", "conversion", "compliance"]) {
      expect(html).toContain(`data-testid="landing-pain-${key}"`);
      expect(html).toContain(`landing.painPoints.items.${key}.title`);
      expect(html).toContain(`landing.painPoints.items.${key}.body`);
    }
    expect(html.match(/data-testid="landing-pain-/g)?.length).toBe(4);
    for (const icon of ["travel_explore", "query_stats", "trending_down", "gpp_maybe"]) {
      expect(html).toContain(icon);
    }
  });
});

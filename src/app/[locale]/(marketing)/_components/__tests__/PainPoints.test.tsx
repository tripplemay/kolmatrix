/**
 * BL-115-F003 · PainPoints spec — 4 email pain cards (scattered /
 * deliverability / tracking / compliance) with the spec'd icons.
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

describe("BL-115-F003 PainPoints", () => {
  it("renders 4 email pain cards with the spec icons", async () => {
    const html = renderToStaticMarkup(await PainPoints());
    expect(html).toContain('data-testid="landing-painpoints"');
    for (const key of ["scattered", "deliverability", "tracking", "compliance"]) {
      expect(html).toContain(`data-testid="landing-pain-${key}"`);
      expect(html).toContain(`landing.painPoints.items.${key}.title`);
      expect(html).toContain(`landing.painPoints.items.${key}.body`);
    }
    expect(html.match(/data-testid="landing-pain-/g)?.length).toBe(4);
    for (const icon of ["inbox", "trending_down", "visibility_off", "gpp_maybe"]) {
      expect(html).toContain(icon);
    }
  });
});

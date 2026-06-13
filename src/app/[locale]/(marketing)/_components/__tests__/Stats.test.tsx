/**
 * BL-114-F003 · Stats spec — verifies the Stitch prototype: 3 gradient
 * figures (display constants) + localized captions.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl/server", () => ({
  getTranslations: async (arg: string | { namespace?: string }) => {
    const namespace = typeof arg === "string" ? arg : (arg?.namespace ?? "");
    return (key: string) => `${namespace}.${key}`;
  },
}));

import { Stats } from "../Stats";

describe("BL-114-F003 Stats (照 Stitch 原型)", () => {
  it("renders 3 gradient figures + captions", async () => {
    const html = renderToStaticMarkup(await Stats());
    expect(html).toContain('data-testid="landing-stats"');
    for (const v of ["6,000+", "5+", "100%"]) expect(html).toContain(v);
    for (const k of ["kols", "languages", "roi"]) {
      expect(html).toContain(`data-testid="landing-stat-${k}"`);
      expect(html).toContain(`landing.stats.items.${k}.label`);
    }
    expect(html.match(/data-testid="landing-stat-/g)?.length).toBe(3);
    // gradient figure treatment
    expect(html).toContain("gradient-text");
  });
});

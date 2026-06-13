/**
 * BL-114-F002 · Features bento spec — verifies the Stitch "Neural Velocity"
 * prototype: exactly 4 capability cards (Brief / Match / Reach / Insight),
 * each with a mono label + the spec'd Material Symbols icon, wired to
 * landing.features.items.*. Source-render via renderToStaticMarkup with
 * next-intl mocked (async server component).
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl/server", () => ({
  getTranslations: async (arg: string | { namespace?: string }) => {
    const namespace = typeof arg === "string" ? arg : (arg?.namespace ?? "");
    return (key: string) => `${namespace}.${key}`;
  },
}));

import { Features } from "../Features";

describe("BL-114-F002 Features bento (照 Stitch 原型)", () => {
  it("renders exactly the 4 capability cards with mono labels + spec icons", async () => {
    const html = renderToStaticMarkup(await Features());

    expect(html).toContain('data-testid="landing-features"');

    for (const key of ["brief", "match", "reach", "insight"]) {
      expect(html).toContain(`data-testid="landing-feature-${key}"`);
      expect(html).toContain(`landing.features.items.${key}.label`);
      expect(html).toContain(`landing.features.items.${key}.title`);
      expect(html).toContain(`landing.features.items.${key}.body`);
    }
    // Exactly 4 cards — no leftover 6-card BL-080 structure.
    expect(html.match(/data-testid="landing-feature-/g)?.length).toBe(4);

    // Spec F002 icons (Reach = forward_to_inbox, not the prototype's rocket_launch).
    for (const icon of ["auto_awesome", "travel_explore", "forward_to_inbox", "query_stats"]) {
      expect(html).toContain(icon);
    }

    // Mono label utility (JetBrains via font-landing-mono).
    expect(html).toContain("font-landing-mono");
  });
});

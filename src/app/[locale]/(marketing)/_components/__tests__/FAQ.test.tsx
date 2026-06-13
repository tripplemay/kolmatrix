/**
 * BL-114-F003 · FAQ spec — verifies the Stitch prototype tonal accordion:
 * one details card per landing.faq.items entry + an expand_more chevron.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const ITEMS = [
  { q: "Q-ALPHA", a: "A-ALPHA" },
  { q: "Q-BRAVO", a: "A-BRAVO" },
];

vi.mock("next-intl/server", () => ({
  getTranslations: async () => {
    const t = (key: string) => `landing.faq.${key}`;
    t.raw = (key: string) => (key === "items" ? ITEMS : key);
    return t;
  },
}));

import { FAQ } from "../FAQ";

describe("BL-114-F003 FAQ (照 Stitch 原型)", () => {
  it("renders a tonal accordion card per item with an expand_more chevron", async () => {
    const html = renderToStaticMarkup(await FAQ());
    expect(html).toContain('data-testid="landing-faq"');
    expect(html).toContain("landing.faq.sectionTitle");
    for (const [i, item] of ITEMS.entries()) {
      expect(html).toContain(`data-testid="landing-faq-item-${i}"`);
      expect(html).toContain(item.q);
      expect(html).toContain(item.a);
    }
    expect(html).toContain("expand_more");
    expect(html).toContain("landing-faq-chevron");
  });
});

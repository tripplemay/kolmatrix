/**
 * BL-114-F003 · Closing CTA spec — verifies the Stitch prototype panel:
 * title + subtitle + gradient primary CTA (/request-access) + text secondary
 * (/request-access?demo=1) + copyright line.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl/server", () => ({
  getTranslations: async (arg: string | { namespace?: string }) => {
    const namespace = typeof arg === "string" ? arg : (arg?.namespace ?? "");
    return (key: string) => `${namespace}.${key}`;
  },
}));

import { FooterCTA } from "../FooterCTA";

describe("BL-114-F003 FooterCTA (照 Stitch 原型)", () => {
  it("renders the CTA panel with localized routes + copyright", async () => {
    const html = renderToStaticMarkup(await FooterCTA({ locale: "en" }));
    expect(html).toContain('data-testid="landing-footer-cta"');
    expect(html).toContain("landing.footerCta.sectionTitle");
    expect(html).toContain("landing.footerCta.subtitle");
    expect(html).toContain("landing.footerCta.footerLine");
    expect(html).toContain('data-testid="landing-footer-cta-primary"');
    expect(html).toContain("/en/request-access");
    expect(html).toContain('data-testid="landing-footer-cta-secondary"');
    expect(html).toContain("/en/request-access?demo=1");
    // gradient primary CTA
    expect(html).toContain("landing-cta-primary");
  });
});

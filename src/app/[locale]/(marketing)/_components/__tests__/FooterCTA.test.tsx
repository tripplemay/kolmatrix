/**
 * BL-114-F003 / BL-115-F001 · Closing CTA spec — panel title/subtitle/
 * copyright, the primary trial-modal CTA (stubbed), and the secondary
 * 1:1-demo link (/request-access?demo=1). TrialLeadCta is a client component
 * (pulls in the server action) → stubbed so this stays a pure render test.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl/server", () => ({
  getTranslations: async (arg: string | { namespace?: string }) => {
    const namespace = typeof arg === "string" ? arg : (arg?.namespace ?? "");
    return (key: string) => `${namespace}.${key}`;
  },
}));

vi.mock("../TrialLeadCta", () => ({
  TrialLeadCta: (props: { label: string; ctaId: string }) =>
    createElement("button", { "data-testid": `trial-cta-${props.ctaId}` }, props.label),
}));

import { FooterCTA } from "../FooterCTA";

describe("BL-114-F003 / BL-115-F001 FooterCTA", () => {
  it("renders the panel with the trial CTA + 1:1 demo link + copyright", async () => {
    const html = renderToStaticMarkup(await FooterCTA({ locale: "en" }));
    expect(html).toContain('data-testid="landing-footer-cta"');
    expect(html).toContain("landing.footerCta.sectionTitle");
    expect(html).toContain("landing.footerCta.subtitle");
    expect(html).toContain("landing.footerCta.footerLine");
    // Primary = trial modal (stubbed); secondary = real demo route.
    expect(html).toContain('data-testid="trial-cta-footer"');
    expect(html).toContain("landing.footerCta.ctaPrimary");
    expect(html).toContain('data-testid="landing-footer-cta-secondary"');
    expect(html).toContain("/en/request-access?demo=1");
  });
});

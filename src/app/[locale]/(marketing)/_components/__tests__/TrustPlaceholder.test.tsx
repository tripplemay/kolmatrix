/**
 * BL-115-F004 · Trust framework spec — replaces the fake "Trusted by" studio
 * wordmarks with honest framing: genre verticals (not real game-IP names),
 * real security/compliance badges, and a testimonial placeholder.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl/server", () => ({
  getTranslations: async (arg: string | { namespace?: string }) => {
    const namespace = typeof arg === "string" ? arg : (arg?.namespace ?? "");
    return (key: string) => `${namespace}.${key}`;
  },
}));

import { TrustPlaceholder } from "../TrustPlaceholder";

describe("BL-115-F004 trust framework", () => {
  it("renders genre verticals, real security badges, and a testimonial placeholder", async () => {
    const html = renderToStaticMarkup(await TrustPlaceholder());

    expect(html).toContain('data-testid="landing-trust"');
    expect(html).toContain("landing.trust.title");
    expect(html).toContain("landing.trust.verticalsCaption");

    // Genre verticals (generic — NOT real game-IP names).
    for (const v of ["RPG", "MOBA", "SLG"]) {
      expect(html).toContain(`data-testid="landing-vertical-${v}"`);
    }

    // Real security / compliance badges.
    for (const key of ["encryption", "isolation", "compliance", "ai"]) {
      expect(html).toContain(`data-testid="landing-badge-${key}"`);
      expect(html).toContain(`landing.trust.badges.${key}`);
    }

    // Honest testimonial placeholder (no fabricated quote).
    expect(html).toContain('data-testid="landing-testimonial-placeholder"');
    expect(html).toContain("landing.trust.testimonialNote");

    // The fake "Trusted by" studio wordmarks are gone.
    expect(html).not.toContain("ZENITH");
    expect(html).not.toContain("NEXUS_G");
  });
});

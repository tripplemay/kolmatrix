/**
 * BL-114-F001 / F002 / BL-115-F001 · Hero spec — verifies the Neural Velocity
 * Hero: eyebrow + gradient title + lede, the 4-item email data bar, the
 * primary trial-modal CTA (BL-115-F001) + secondary PRD link, and the
 * restored dashboard preview. TrialLeadCta is a client component (next-intl /
 * useActionState / Dialog) → stubbed here; it has its own spec.
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

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) =>
    createElement("img", {
      src: props.src,
      alt: props.alt,
      className: props.className,
      "data-testid": props["data-testid"],
    }),
}));

vi.mock("../TrialLeadCta", () => ({
  TrialLeadCta: (props: { label: string; ctaId: string }) =>
    createElement("button", { "data-testid": `trial-cta-${props.ctaId}` }, props.label),
}));

import { HeroVideo } from "../HeroVideo";

describe("BL-114 / BL-115 Hero", () => {
  it("renders eyebrow, gradient title, lede, trial CTA + PRD link, dashboard preview", async () => {
    const html = renderToStaticMarkup(await HeroVideo());

    expect(html).toContain("landing.hero.eyebrow");
    expect(html).toContain("landing.hero.title_line1");
    expect(html).toContain("landing.hero.title_line2");
    expect(html).toContain("landing.hero.subtitle");
    expect(html).toContain("gradient-text");

    // BL-115-F001: primary CTA = trial modal (stubbed); secondary = PRD link.
    expect(html).toContain('data-testid="trial-cta-hero"');
    expect(html).toContain("landing.hero.ctaPrimary");
    expect(html).toContain('data-testid="landing-cta-prd"');
    expect(html).toContain("https://kol.saga1001.com/prd");
    expect(html).toContain("landing.hero.ctaSecondary");

    // Dashboard preview illustration (kept hero-illustration.png).
    expect(html).toContain('data-testid="landing-hero-illustration"');
    expect(html).toContain("/landing/illustrations/hero-illustration.png");
  });

  it("renders the 4-item email data bar with truthful values (no reply rate)", async () => {
    const html = renderToStaticMarkup(await HeroVideo());

    expect(html).toContain('data-testid="landing-hero-stats"');
    for (const key of ["templates", "compliance", "tracking", "reputation"]) {
      expect(html).toContain(`data-testid="landing-hero-stat-${key}"`);
      expect(html).toContain(`landing.hero.stats.${key}.label`);
    }
    expect(html.match(/data-testid="landing-hero-stat-/g)?.length).toBe(4);

    expect(html).toContain("1000+");
    expect(html).toContain("DKIM · SPF · DMARC");
    expect(html).toContain("98%");
    expect(html).toContain("landing.hero.stats.tracking.value");

    // Truthfulness guard: reply rate must NOT appear (repliedAt never written).
    expect(html.toLowerCase()).not.toContain("reply rate");
    expect(html).not.toContain("回复率");
  });
});

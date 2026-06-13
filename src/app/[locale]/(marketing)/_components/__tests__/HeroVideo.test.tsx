/**
 * BL-114-F001 (redo) · Hero spec — verifies the Stitch "Neural Velocity"
 * prototype structure: cyan mono eyebrow, gradient display title, lede, both
 * CTAs (correct request-access routes + testids), and the restored
 * hero-illustration.png dashboard preview.
 *
 * HeroVideo is an async server component; we render it via
 * renderToStaticMarkup(await Hero(...)) with next-intl + next/image mocked
 * (mirrors the crawler-monitor page spec pattern).
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl/server", () => ({
  // HeroVideo calls getTranslations("landing.hero") (string form); echo the
  // namespaced key back so assertions can confirm each slot is wired.
  getTranslations: async (arg: string | { namespace?: string }) => {
    const namespace = typeof arg === "string" ? arg : (arg?.namespace ?? "");
    return (key: string) => `${namespace}.${key}`;
  },
}));

vi.mock("next/image", () => ({
  // Render a plain img with only the DOM-safe props (drops fill/sizes/etc.).
  // createElement("img") avoids the JSX-only no-img-element / alt-text rules.
  default: (props: Record<string, unknown>) =>
    createElement("img", {
      src: props.src,
      alt: props.alt,
      className: props.className,
      "data-testid": props["data-testid"],
    }),
}));

import { HeroVideo } from "../HeroVideo";

describe("BL-114-F001 Hero (照 Stitch 原型 redo)", () => {
  it("renders eyebrow, gradient title, lede, both CTAs and the dashboard preview", async () => {
    const html = renderToStaticMarkup(await HeroVideo({ locale: "en" }));

    // Eyebrow + title + lede slots wired to landing.hero.*
    expect(html).toContain("landing.hero.eyebrow");
    expect(html).toContain("landing.hero.title_line1");
    expect(html).toContain("landing.hero.title_line2");
    expect(html).toContain("landing.hero.subtitle");

    // Gradient treatment on the title's second line.
    expect(html).toContain("gradient-text");

    // Primary CTA → /request-access; secondary → /request-access?demo=1.
    expect(html).toContain('data-testid="landing-cta-primary"');
    expect(html).toContain("/en/request-access");
    expect(html).toContain('data-testid="landing-cta-secondary"');
    expect(html).toContain("/en/request-access?demo=1");

    // Dashboard preview illustration restored (kept hero-illustration.png).
    expect(html).toContain('data-testid="landing-hero-illustration"');
    expect(html).toContain("/landing/illustrations/hero-illustration.png");
  });

  it("scopes CTA hrefs to the active locale", async () => {
    const html = renderToStaticMarkup(await HeroVideo({ locale: "ja" }));
    expect(html).toContain("/ja/request-access");
    expect(html).toContain("/ja/request-access?demo=1");
  });

  // BL-115-F002 — email-collaboration data bar.
  it("renders the 4-item email data bar with truthful values (no reply rate)", async () => {
    const html = renderToStaticMarkup(await HeroVideo({ locale: "en" }));

    expect(html).toContain('data-testid="landing-hero-stats"');
    for (const key of ["templates", "compliance", "tracking", "reputation"]) {
      expect(html).toContain(`data-testid="landing-hero-stat-${key}"`);
      expect(html).toContain(`landing.hero.stats.${key}.label`);
    }
    expect(html.match(/data-testid="landing-hero-stat-/g)?.length).toBe(4);

    // Universal constant values; tracking value comes from i18n.
    expect(html).toContain("1000+");
    expect(html).toContain("DKIM · SPF · DMARC");
    expect(html).toContain("98%");
    expect(html).toContain("landing.hero.stats.tracking.value");

    // Truthfulness guard: reply rate must NOT appear (repliedAt never written).
    expect(html.toLowerCase()).not.toContain("reply rate");
    expect(html).not.toContain("回复率");
  });
});

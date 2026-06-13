/**
 * BL-114-F003 · How-it-works spec — verifies the Stitch prototype: heading +
 * 3 mono-numbered phases (01 / 02 / 03) wired to landing.howItWorks.*.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl/server", () => ({
  getTranslations: async (arg: string | { namespace?: string }) => {
    const namespace = typeof arg === "string" ? arg : (arg?.namespace ?? "");
    return (key: string) => `${namespace}.${key}`;
  },
}));

import { HowItWorks } from "../HowItWorks";

describe("BL-114-F003 HowItWorks (照 Stitch 原型)", () => {
  it("renders heading + exactly 3 mono-numbered phases", async () => {
    const html = renderToStaticMarkup(await HowItWorks());
    expect(html).toContain('data-testid="landing-how-it-works"');
    expect(html).toContain("landing.howItWorks.title");
    expect(html).toContain("landing.howItWorks.subtitle");
    for (const [i, s] of ["s1", "s2", "s3"].entries()) {
      expect(html).toContain(`data-testid="landing-step-${i + 1}"`);
      expect(html).toContain(`landing.howItWorks.steps.${s}.title`);
      expect(html).toContain(`landing.howItWorks.steps.${s}.body`);
    }
    // mono step numbers
    for (const n of ["01", "02", "03"]) expect(html).toContain(n);
    expect(html.match(/data-testid="landing-step-/g)?.length).toBe(3);
    expect(html).toContain("font-landing-mono");
  });
});

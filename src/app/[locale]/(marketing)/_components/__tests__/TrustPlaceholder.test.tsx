/**
 * BL-114-F002 · Logo strip spec — verifies the Stitch "Neural Velocity"
 * prototype: a mono "trusted by" caption above 5 placeholder studio
 * wordmarks. Source-render via renderToStaticMarkup with next-intl mocked.
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

describe("BL-114-F002 logo strip (照 Stitch 原型)", () => {
  it("renders the trusted-by caption + 5 muted wordmarks", async () => {
    const html = renderToStaticMarkup(await TrustPlaceholder());

    expect(html).toContain('data-testid="landing-logos"');
    expect(html).toContain("landing.trust.caption");

    for (const name of ["ZENITH", "NEXUS_G", "VOID_LABS", "APEX_INT", "STORM_WK"]) {
      expect(html).toContain(name);
    }
    expect(html.match(/data-testid="landing-logo-/g)?.length).toBe(5);
  });
});

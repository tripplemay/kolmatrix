/**
 * BL-115-F003 · EmailCenterDemo spec — 3 static panels (domain health /
 * recent sends / template library) mirroring the real reach UI. Truthfulness
 * guard: recent sends show delivery/open status only — no reply rate.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl/server", () => ({
  getTranslations: async (arg: string | { namespace?: string }) => {
    const namespace = typeof arg === "string" ? arg : (arg?.namespace ?? "");
    return (key: string) => `${namespace}.${key}`;
  },
}));

import { EmailCenterDemo } from "../EmailCenterDemo";

describe("BL-115-F003 EmailCenterDemo", () => {
  it("renders the 3 email-center panels with real data points", async () => {
    const html = renderToStaticMarkup(await EmailCenterDemo());
    expect(html).toContain('data-testid="landing-email-demo"');
    // BL-117-F002 — Reach-pillar eyebrow (de-emphasized framing).
    expect(html).toContain('data-testid="landing-demo-eyebrow"');
    expect(html).toContain("landing.demo.eyebrow");
    expect(html).toContain('data-testid="landing-demo-health"');
    expect(html).toContain('data-testid="landing-demo-sends"');
    expect(html).toContain('data-testid="landing-demo-templates"');

    // Domain health mirrors DomainHealthCard (DKIM/SPF/DMARC + reputation 98).
    expect(html).toContain("DKIM");
    expect(html).toContain("SPF");
    expect(html).toContain("DMARC");
    expect(html).toContain("98");

    // Game-vertical template chips (constants).
    expect(html).toContain("RPG");
    expect(html).toContain("MOBA");

    // Truthfulness: delivery/open status only — never reply rate.
    expect(html).toContain("landing.demo.sends.statusDelivered");
    expect(html).toContain("landing.demo.sends.statusOpened");
    expect(html.toLowerCase()).not.toContain("reply");
    expect(html).not.toContain("回复");
  });
});

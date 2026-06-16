/**
 * BL-117-F003 — positioning-rebalance content lock. The FAQ is now a broad +
 * email mix (was all-email), and the SEO meta leads with the broad "global
 * game KOL marketing" framing (no longer "email collaboration hub").
 */
import { readFileSync } from "fs";
import { resolve } from "path";

import { describe, expect, it } from "vitest";

interface FaqItem {
  q: string;
  a: string;
}

const landing = JSON.parse(
  readFileSync(resolve(__dirname, "../../messages/en.json"), "utf8"),
).landing;

describe("BL-117-F003 positioning rebalance (en)", () => {
  it("FAQ is a broad + email mix of 4 items", () => {
    const items = landing.faq.items as FaqItem[];
    expect(items).toHaveLength(4);
    const qs = items.map((i) => i.q.toLowerCase()).join(" | ");
    // 2 broad questions (discovery/shortlist + AI matching / ROI).
    expect(qs).toMatch(/find|shortlist/);
    expect(qs).toMatch(/roi|matching/);
    // 2 email questions kept (DKIM + templates).
    expect(qs).toMatch(/dkim/);
    expect(qs).toMatch(/template/);
  });

  it("SEO meta leads broad, not email-hub", () => {
    expect(landing.meta.title.toLowerCase()).not.toContain("email marketing");
    expect(landing.meta.description.toLowerCase()).not.toContain("email collaboration hub");
    expect(landing.meta.description.toLowerCase()).toMatch(/command center|discovery|matching/);
  });
});

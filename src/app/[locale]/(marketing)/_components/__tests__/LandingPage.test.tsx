/**
 * BL-114-F003 · LandingPage structure lock — source-grep (no render) guard
 * that the section order matches the Stitch prototype and the legacy
 * PainPoints / BeforeAfter / EmailCenterDemo sections are gone. Mirrors the
 * repo's fidelity-grep test style for composed server components.
 */
import { readFileSync } from "fs";
import { resolve } from "path";

import { describe, expect, it } from "vitest";

const SRC = readFileSync(resolve(__dirname, "../LandingPage.tsx"), "utf8");

describe("BL-114-F003 LandingPage structure (照 Stitch 原型)", () => {
  it("mounts the prototype sections in order", () => {
    const order = [
      "<TopNav",
      "<HeroVideo",
      "<TrustPlaceholder",
      "<Features",
      "<HowItWorks",
      "<Stats",
      "<FAQ",
      "<FooterCTA",
    ];
    const positions = order.map((tag) => SRC.indexOf(tag));
    for (const [i, pos] of positions.entries()) {
      expect(pos, `${order[i]} not mounted`).toBeGreaterThan(-1);
      if (i > 0) {
        expect(pos, `${order[i]} out of prototype order`).toBeGreaterThan(positions[i - 1]);
      }
    }
  });

  it("drops the legacy sections absent from the prototype", () => {
    // Check for real import + JSX mount (the docstring may still name them
    // while explaining the removal).
    for (const gone of ["PainPoints", "BeforeAfter", "EmailCenterDemo", "SectionTransition"]) {
      expect(SRC, `<${gone}> should be unmounted`).not.toContain(`<${gone}`);
      expect(SRC, `${gone} should not be imported`).not.toMatch(
        new RegExp(`import\\s+\\{[^}]*\\b${gone}\\b`)
      );
    }
  });

  it("renders on a single dark navy-base canvas", () => {
    expect(SRC).toContain("bg-navy-base");
  });
});

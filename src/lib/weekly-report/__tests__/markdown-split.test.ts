import { describe, expect, it } from "vitest";

import { PREAMBLE_KEY, getSection, splitByH2 } from "../markdown-split";

describe("splitByH2", () => {
  it("returns an empty object for empty input", () => {
    expect(splitByH2("")).toEqual({});
  });

  it("collects content before the first H2 under _preamble", () => {
    const md = "Intro line\n\n## First Section\nbody";
    const out = splitByH2(md);
    expect(out[PREAMBLE_KEY]).toBe("Intro line");
    expect(out["First Section"]).toBe("body");
  });

  it("splits the canonical 5-section AI report", () => {
    const md = [
      "## Executive Summary",
      "Para one.",
      "",
      "Para two.",
      "",
      "## Top Performers",
      "*   **GamerXia:** 812% ROI",
      "*   **MOBA_Queen:** 420% ROI",
      "",
      "## Key Activity",
      "Onboarded 3 new partnerships.",
      "",
      "## Key Insights",
      "*   **Scaling Efficiency:** detail",
      "*   **Market Fit:** detail",
      "",
      "## Looking Ahead",
      "*   Finalize NintendoGalaxy",
      "*   Pilot SEA expansion",
    ].join("\n");
    const out = splitByH2(md);
    expect(Object.keys(out).sort()).toEqual([
      "Executive Summary",
      "Key Activity",
      "Key Insights",
      "Looking Ahead",
      "Top Performers",
    ]);
    expect(out["Executive Summary"]).toContain("Para one.");
    expect(out["Executive Summary"]).toContain("Para two.");
    expect(out["Top Performers"]).toContain("GamerXia");
    expect(out["Looking Ahead"]).toContain("NintendoGalaxy");
  });

  it("ignores extra whitespace after the heading text", () => {
    const md = "##   Heading With Spaces   \nbody";
    const out = splitByH2(md);
    expect(out["Heading With Spaces"]).toBe("body");
  });

  it("does not treat ### or # as section boundaries", () => {
    const md = "## A\nbody A\n\n### Sub of A\nstill A\n\n## B\nbody B";
    const out = splitByH2(md);
    expect(out["A"]).toContain("### Sub of A");
    expect(out["A"]).toContain("still A");
    expect(out["B"]).toBe("body B");
  });

  it("handles unicode (Chinese) headings", () => {
    const md = "## 执行摘要\n本周表现优异。\n\n## 关键洞察\n*   要点 1";
    const out = splitByH2(md);
    expect(out["执行摘要"]).toBe("本周表现优异。");
    expect(out["关键洞察"]).toBe("*   要点 1");
  });

  it("drops empty section bodies", () => {
    const md = "## Empty\n\n## Has Content\nyes";
    const out = splitByH2(md);
    expect(out["Empty"]).toBeUndefined();
    expect(out["Has Content"]).toBe("yes");
  });
});

describe("getSection", () => {
  it("returns the matching section by exact heading", () => {
    const sections = { "Executive Summary": "body" };
    expect(getSection(sections, "Executive Summary")).toBe("body");
    expect(getSection(sections, "executive summary")).toBeUndefined();
    expect(getSection(sections, "Missing")).toBeUndefined();
  });
});

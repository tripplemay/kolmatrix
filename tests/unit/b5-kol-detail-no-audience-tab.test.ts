import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const source = readFileSync(
  path.resolve(process.cwd(), "src/app/[locale]/(app)/kols/[id]/KolTabsNav.tsx"),
  "utf8"
);

describe("B5-F005 kol detail audience-tab guardrail", () => {
  it("keeps KolTabKey narrowed to the four shipped tabs", () => {
    expect(source).toMatch(
      /export type KolTabKey = "overview" \| "collabs" \| "contacts" \| "ai";/
    );
  });

  it("keeps the rendered tab list free of an audience placeholder", () => {
    const tabsDecl = source.match(/const TABS: KolTabKey\[\] = \[([\s\S]+?)\];/);

    expect(tabsDecl?.[1]).toBeDefined();
    expect(tabsDecl![1]).toContain('"overview"');
    expect(tabsDecl![1]).toContain('"collabs"');
    expect(tabsDecl![1]).toContain('"contacts"');
    expect(tabsDecl![1]).toContain('"ai"');
    expect(tabsDecl![1]).not.toContain('"audience"');
  });
});

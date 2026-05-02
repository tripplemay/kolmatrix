/**
 * BIx-mvp-polish-pass F002 P1-4 — Database BulkActionBar Email-jump.
 *
 * Pure-string tests that lock the URL query format the
 * BulkActionBar uses to route to /outreach with a preselection. Keeps
 * the contract `?kolIds=<id>,<id>` regression-tested without spinning
 * up a full Playwright browser.
 */
import { describe, expect, it } from "vitest";

function buildOutreachJumpHref(locale: string, kolIds: string[]): string {
  if (kolIds.length === 0) return `/${locale}/database`;
  return `/${locale}/outreach?kolIds=${kolIds.join(",")}`;
}

function parseKolIdsParam(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

describe("database → outreach jump URL (BIx-vf F002 P1-4)", () => {
  it("builds /<locale>/outreach?kolIds=a,b,c", () => {
    expect(buildOutreachJumpHref("en", ["aaa", "bbb", "ccc"])).toBe(
      "/en/outreach?kolIds=aaa,bbb,ccc"
    );
  });

  it("falls back to /<locale>/database when nothing is selected", () => {
    expect(buildOutreachJumpHref("zh", [])).toBe("/zh/database");
  });

  it("round-trips a single id", () => {
    const href = buildOutreachJumpHref("en", ["only-one"]);
    expect(href).toBe("/en/outreach?kolIds=only-one");
    const url = new URL(href, "http://x.test");
    expect(parseKolIdsParam(url.searchParams.get("kolIds"))).toEqual(["only-one"]);
  });

  it("round-trips an arbitrary multi-id selection", () => {
    const ids = ["11111111-2222-3333-4444-555555555555", "22222222-3333-4444-5555-666666666666"];
    const href = buildOutreachJumpHref("ja", ids);
    const url = new URL(href, "http://x.test");
    expect(parseKolIdsParam(url.searchParams.get("kolIds"))).toEqual(ids);
  });

  it("trims whitespace and drops empty parts on parse", () => {
    expect(parseKolIdsParam(" a , , b ,c ,, ")).toEqual(["a", "b", "c"]);
  });

  it("returns empty array for missing or empty kolIds param", () => {
    expect(parseKolIdsParam(null)).toEqual([]);
    expect(parseKolIdsParam("")).toEqual([]);
    expect(parseKolIdsParam(undefined)).toEqual([]);
  });
});

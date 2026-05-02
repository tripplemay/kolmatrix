/**
 * BL-025-F004 · URL filter state — pure parser specs.
 *
 * The hook itself relies on Next.js router state which would need a
 * NextRouter mock; we cover the parsing + serialisation primitives
 * here (the `update` helper just composes URLSearchParams + splits/
 * joins) so any regression in the URL contract surfaces quickly.
 */
import { describe, expect, it } from "vitest";

import { readAssetFiltersFromQuery, toAssetFilter } from "../use-filter-state";

describe("readAssetFiltersFromQuery", () => {
  it("returns the defaults when the query is empty", () => {
    const sp = new URLSearchParams();
    expect(readAssetFiltersFromQuery(sp)).toEqual({
      productId: undefined,
      types: undefined,
      status: undefined,
      sources: undefined,
      search: undefined,
      sort: "recent",
      view: "grid",
    });
  });

  it("parses a fully populated query into the typed shape", () => {
    const sp = new URLSearchParams({
      productId: "prod-1",
      types: "email,video_script",
      status: "draft",
      sources: "ai_generated,user_created",
      search: "hello",
      sort: "name",
      view: "list",
    });
    expect(readAssetFiltersFromQuery(sp)).toEqual({
      productId: "prod-1",
      types: ["email", "video_script"],
      status: "draft",
      sources: ["ai_generated", "user_created"],
      search: "hello",
      sort: "name",
      view: "list",
    });
  });

  it("drops invalid enum values silently (sort) and falls back to defaults", () => {
    const sp = new URLSearchParams({ sort: "definitely-not-a-sort", view: "junk" });
    const state = readAssetFiltersFromQuery(sp);
    expect(state.sort).toBe("recent");
    expect(state.view).toBe("grid");
  });

  it("drops invalid items inside the comma-separated arrays", () => {
    const sp = new URLSearchParams({ types: "email,nonsense,video_script" });
    expect(readAssetFiltersFromQuery(sp).types).toEqual(["email", "video_script"]);
  });

  it("returns undefined for an array filter when every value is invalid", () => {
    const sp = new URLSearchParams({ sources: "junk-only" });
    expect(readAssetFiltersFromQuery(sp).sources).toBeUndefined();
  });
});

describe("toAssetFilter", () => {
  it("strips empty arrays + blank search before handing to the query layer", () => {
    expect(
      toAssetFilter({
        productId: undefined,
        types: [],
        status: undefined,
        sources: [],
        search: "   ",
        sort: "recent",
        view: "grid",
      })
    ).toEqual({});
  });

  it("trims the search string and preserves enum values", () => {
    expect(
      toAssetFilter({
        productId: "prod-1",
        types: ["email"],
        status: "published",
        sources: ["ai_generated"],
        search: "  hi  ",
        sort: "recent",
        view: "grid",
      })
    ).toEqual({
      productId: "prod-1",
      types: ["email"],
      status: "published",
      sources: ["ai_generated"],
      search: "hi",
    });
  });
});

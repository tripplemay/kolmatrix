/**
 * MVP-vf-F002 · /discovery view-mode parser tests.
 *
 * Regression guard: the SummaryBar renders the Grid/List toggle off
 * `parseView(searchParams)`. If parsing accepts an arbitrary string
 * the wrong icon ends up active and visual baselines drift.
 */
import { describe, expect, it } from "vitest";

import { parseView } from "../view-mode";

describe("discovery view-mode parser", () => {
  it("defaults to grid when no view param present", () => {
    expect(parseView({})).toBe("grid");
  });

  it("returns 'list' only for the literal string 'list'", () => {
    expect(parseView({ view: "list" })).toBe("list");
    expect(parseView({ view: "List" })).toBe("grid");
    expect(parseView({ view: "table" })).toBe("grid");
    expect(parseView({ view: "" })).toBe("grid");
  });

  it("treats undefined / null-equivalent input as grid", () => {
    expect(parseView({ view: undefined })).toBe("grid");
  });

  it("accepts the array shape produced by Next searchParams", () => {
    expect(parseView({ view: ["list"] })).toBe("list");
    expect(parseView({ view: ["grid"] })).toBe("grid");
    expect(parseView({ view: [] })).toBe("grid");
  });
});

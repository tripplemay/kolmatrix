/**
 * BL-024-F001-1 — csvCell formula-injection + RFC-4180 quoting.
 */
import { describe, expect, it } from "vitest";

import { csvCell, csvRow } from "../cell";

describe("csvCell — null / undefined", () => {
  it("renders null and undefined as empty string", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });
});

describe("csvCell — formula injection guard", () => {
  it.each(["=HYPERLINK(1)", "+1", "-2", "@SUM(A1)"])(
    "prefixes formula-trigger cell %s with single quote",
    (input) => {
      expect(csvCell(input)).toBe(`'${input}`);
    }
  );

  it("guards against tab/CR-leading formula injections", () => {
    expect(csvCell("\t=evil")).toContain("'");
    expect(csvCell("\r=evil")).toContain("'");
  });

  it("does not prefix safe cells", () => {
    expect(csvCell("normal")).toBe("normal");
    expect(csvCell("123")).toBe("123");
    expect(csvCell("user@example.com")).toBe("user@example.com");
  });
});

describe("csvCell — RFC-4180 quoting", () => {
  it("wraps cells with comma in quotes", () => {
    expect(csvCell("a,b")).toBe(`"a,b"`);
  });

  it('escapes embedded double quotes', () => {
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
  });

  it("wraps newline-bearing cells in quotes", () => {
    expect(csvCell("line1\nline2")).toBe(`"line1\nline2"`);
    expect(csvCell("a\rb")).toBe(`"a\rb"`);
  });
});

describe("csvCell — formula injection + comma combo", () => {
  it("applies both guards to =HYPERLINK,EVIL", () => {
    // Formula prefix runs first, then RFC-4180 wraps because of comma.
    expect(csvCell("=A1,B1")).toBe(`"'=A1,B1"`);
  });
});

describe("csvRow", () => {
  it("joins cells with commas after applying csvCell to each", () => {
    expect(csvRow(["a", "b,c", "=evil", null])).toBe(`a,"b,c",'=evil,`);
  });
});

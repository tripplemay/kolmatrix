import { describe, expect, it } from "vitest";

import { CsvParseError, parseCsv } from "../parse";

describe("parseCsv — basics", () => {
  it("parses a simple 2-column CSV", () => {
    const out = parseCsv("a,b\n1,2\n3,4\n");
    expect(out.header).toEqual(["a", "b"]);
    expect(out.rows).toEqual([
      { a: "1", b: "2" },
      { a: "3", b: "4" },
    ]);
  });

  it("ignores trailing blank line", () => {
    expect(parseCsv("a\n1\n\n").rows).toEqual([{ a: "1" }]);
  });

  it("strips UTF-8 BOM", () => {
    expect(parseCsv("﻿a,b\n1,2").header).toEqual(["a", "b"]);
  });

  it("returns empty result for empty / whitespace-only input", () => {
    expect(parseCsv("").rows).toEqual([]);
    expect(parseCsv("   \n").rows).toEqual([]);
  });
});

describe("parseCsv — RFC-4180 quoting", () => {
  it("handles cells with embedded commas", () => {
    const out = parseCsv('a,b\n"x,y","z"');
    expect(out.rows).toEqual([{ a: "x,y", b: "z" }]);
  });

  it("handles escaped double quotes", () => {
    const out = parseCsv('a\n"say ""hi"""');
    expect(out.rows).toEqual([{ a: 'say "hi"' }]);
  });

  it("handles newlines inside quoted cells", () => {
    const out = parseCsv('a,b\n"line1\nline2",ok');
    expect(out.rows).toEqual([{ a: "line1\nline2", b: "ok" }]);
  });

  it("handles \\r\\n line endings", () => {
    const out = parseCsv("a,b\r\n1,2\r\n");
    expect(out.rows).toEqual([{ a: "1", b: "2" }]);
  });
});

describe("parseCsv — error path", () => {
  it("throws CsvParseError when a row has the wrong cell count", () => {
    expect(() => parseCsv("a,b\n1,2,3")).toThrow(CsvParseError);
    try {
      parseCsv("a,b,c\n1,2,3\n4,5"); // 2nd data row short
    } catch (err) {
      expect(err).toBeInstanceOf(CsvParseError);
      expect((err as CsvParseError).line).toBe(3);
    }
  });
});

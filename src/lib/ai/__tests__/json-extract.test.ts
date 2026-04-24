import { describe, expect, it } from "vitest";

import { parseFencedJson, stripCodeFence } from "../json-extract";

describe("stripCodeFence", () => {
  it("returns plain JSON untouched", () => {
    expect(stripCodeFence('{"ok":true}')).toBe('{"ok":true}');
  });

  it("peels a ```json ... ``` fence", () => {
    const raw = '```json\n{"ok":true}\n```';
    expect(stripCodeFence(raw)).toBe('{"ok":true}');
  });

  it("peels a bare ``` ... ``` fence", () => {
    const raw = "```\n{\"ok\":true}\n```";
    expect(stripCodeFence(raw)).toBe('{"ok":true}');
  });

  it("trims leading/trailing whitespace around the fence", () => {
    const raw = '   ```json\n{"ok":true}\n```   ';
    expect(stripCodeFence(raw)).toBe('{"ok":true}');
  });

  it("leaves content alone when only a partial fence exists", () => {
    expect(stripCodeFence("```json\n{not closed}")).toBe(
      "```json\n{not closed}"
    );
  });
});

describe("parseFencedJson", () => {
  it("parses JSON through a fence", () => {
    expect(
      parseFencedJson<{ subject: string }>(
        '```json\n{"subject":"hi"}\n```'
      )
    ).toEqual({ subject: "hi" });
  });

  it("parses bare JSON", () => {
    expect(parseFencedJson('{"ok":1}')).toEqual({ ok: 1 });
  });

  it("throws a descriptive error with a preview when payload is not JSON", () => {
    expect(() =>
      parseFencedJson('```json\n{"bad"\n```')
    ).toThrow(/parseFencedJson/);
  });
});

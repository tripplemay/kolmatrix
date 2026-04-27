/**
 * MVP-i18n-full-locale F001 · Unit tests for the i18n-translate script.
 *
 * Five fixtures covering the script's contract:
 *   1. parseArgs validates --target and rejects bad input.
 *   2. findUntranslated treats leaves matching en value as untranslated.
 *   3. extractTokens picks up {placeholders} and HTML tags exhaustively.
 *   4. validateTokenPreservation flags placeholder + tag drift.
 *   5. parseModelJson strips ```json fences when present.
 *   6. actionForLocale routes zh/ja/ko → doubao, es → gemini.
 *
 * No network calls; the aigcgateway client (`callTranslator`) is not
 * exercised here — that path is covered end-to-end by the live
 * dry-run inside CI's smoke + the per-locale F002–F005 batches.
 */
import { describe, expect, it } from "vitest";

import {
  actionForLocale,
  extractTokens,
  findUntranslated,
  parseArgs,
  parseModelJson,
  validateTokenPreservation,
  type JsonObject,
} from "@/../scripts/i18n-translate";

describe("parseArgs", () => {
  it("requires --target with a valid locale", () => {
    expect(() => parseArgs([])).toThrow(/--target/);
    expect(() => parseArgs(["--target", "fr"])).toThrow(/zh\|ja\|ko\|es/);
    expect(parseArgs(["--target", "zh"])).toMatchObject({
      target: "zh",
      dryRun: false,
    });
  });

  it("accepts --dry-run + --section + --max-leaves", () => {
    const args = parseArgs([
      "--target",
      "ja",
      "--dry-run",
      "--section",
      "dashboard",
      "--max-leaves",
      "10",
    ]);
    expect(args).toEqual({
      target: "ja",
      dryRun: true,
      section: "dashboard",
      maxLeaves: 10,
    });
  });

  it("rejects bad --max-leaves", () => {
    expect(() => parseArgs(["--target", "es", "--max-leaves", "0"])).toThrow();
    expect(() => parseArgs(["--target", "es", "--max-leaves", "junk"])).toThrow();
  });
});

describe("findUntranslated", () => {
  const en: JsonObject = {
    dashboard: {
      title: "Dashboard",
      greeting: "Welcome back, {name}.",
      sub: { tag: "AI" },
    },
    common: {
      ok: "OK",
      save: "Save",
    },
  };

  it("returns leaves equal to the en value", () => {
    const target: JsonObject = {
      dashboard: {
        title: "Dashboard", // untranslated
        greeting: "{name}, 欢迎回来。", // translated
        sub: { tag: "AI" }, // untranslated but length 2 — skipped
      },
      common: {
        ok: "OK", // length 2 — skipped
        save: "Save", // untranslated
      },
    };
    const leaves = findUntranslated(en, target);
    const keys = leaves.map((l) => l.path.join("."));
    expect(keys).toContain("dashboard.title");
    expect(keys).toContain("common.save");
    expect(keys).not.toContain("dashboard.greeting");
    expect(keys).not.toContain("dashboard.sub.tag"); // length 2
    expect(keys).not.toContain("common.ok"); // length 2
  });

  it("filters by section when given", () => {
    const target = JSON.parse(JSON.stringify(en)) as JsonObject;
    const leaves = findUntranslated(en, target, "common");
    expect(leaves.every((l) => l.path[0] === "common")).toBe(true);
  });
});

describe("extractTokens", () => {
  it("captures multiple simple placeholders", () => {
    expect(extractTokens("Hi {name}, you have {count} alerts.")).toEqual({
      placeholders: ["{count}", "{name}"],
      tags: [],
      icuShape: [],
    });
  });

  it("captures HTML open + close + self-closing tags", () => {
    expect(extractTokens("<accent>{count}</accent><br></br>")).toEqual({
      placeholders: ["{count}"],
      tags: ["</accent>", "</br>", "<accent>", "<br>"],
      icuShape: [],
    });
  });

  it("captures ICU plural shape (var + branch keys) without inner text", () => {
    const t = extractTokens(
      "{count, plural, one {# saved KOL} other {# saved KOLs}}"
    );
    expect(t.placeholders).toEqual([]);
    expect(t.icuShape).toEqual(["count|plural|one,other"]);
  });

  it("captures ICU branches with =0 and other", () => {
    const t = extractTokens(
      "{count, plural, =0 {No matches} one {# match} other {# matches}}"
    );
    expect(t.icuShape).toEqual(["count|plural|=0,one,other"]);
  });
});

describe("validateTokenPreservation", () => {
  it("passes when placeholders + tags match", () => {
    expect(
      validateTokenPreservation(
        "Hi {name}, <accent>{count}</accent> alerts.",
        "你好 {name}，<accent>{count}</accent> 条提醒。"
      )
    ).toEqual({ ok: true });
  });

  it("flags missing placeholder", () => {
    const r = validateTokenPreservation("Hi {name}.", "你好。");
    expect(r.ok).toBe(false);
    expect("reason" in r && r.reason).toMatch(/placeholder mismatch/);
  });

  it("flags missing HTML tag", () => {
    const r = validateTokenPreservation(
      "<accent>boom</accent>",
      "boom"
    );
    expect(r.ok).toBe(false);
    expect("reason" in r && r.reason).toMatch(/HTML tag mismatch/);
  });

  it("permits ICU plural inner-text translation when shape matches", () => {
    expect(
      validateTokenPreservation(
        "{count, plural, one {# email template} other {# email templates}}",
        "{count, plural, one {# 件のメールテンプレート} other {# 件のメールテンプレート}}"
      )
    ).toEqual({ ok: true });
  });

  it("flags ICU plural shape change (e.g., dropped branch)", () => {
    const r = validateTokenPreservation(
      "{count, plural, =0 {none} one {# x} other {# xs}}",
      "{count, plural, one {# x} other {# xs}}"
    );
    expect(r.ok).toBe(false);
    expect("reason" in r && r.reason).toMatch(/ICU plural shape mismatch/);
  });
});

describe("parseModelJson", () => {
  it("parses raw JSON", () => {
    expect(parseModelJson<{ a: number }>('{"a": 1}')).toEqual({ a: 1 });
  });

  it("strips ```json ... ``` fences", () => {
    const raw = '```json\n{"a": 2}\n```';
    expect(parseModelJson<{ a: number }>(raw)).toEqual({ a: 2 });
  });

  it("strips bare ``` ... ``` fences", () => {
    const raw = '```\n{"a": 3}\n```';
    expect(parseModelJson<{ a: number }>(raw)).toEqual({ a: 3 });
  });
});

describe("actionForLocale", () => {
  it("routes zh/ja/ko to the doubao Action", () => {
    for (const l of ["zh", "ja", "ko"] as const) {
      expect(actionForLocale(l).model).toBe("doubao-pro");
    }
  });

  it("routes es to the gemini Action", () => {
    expect(actionForLocale("es").model).toBe("gemini-2.5-flash-lite");
  });
});

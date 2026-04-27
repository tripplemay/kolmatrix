/**
 * MVP-i18n-F006 · HTML tag preservation gate.
 *
 * For every leaf in en.json that contains inline HTML tags
 * (<accent>, <br>, <strong>, etc.), the matching leaf in each
 * locale (zh/ja/ko/es) must contain the same multiset of tags.
 * Translators are free to reorder text inside the tags but must not
 * add, drop, or rename any tag.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { extractTokens } from "@/../scripts/i18n-translate";

const REPO_ROOT = resolve(__dirname, "../..");

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

function load(locale: string): Record<string, Json> {
  return JSON.parse(
    readFileSync(resolve(REPO_ROOT, `messages/${locale}.json`), "utf8")
  ) as Record<string, Json>;
}

function* leaves(obj: Json, path: string[] = []): Generator<{ path: string; value: string }> {
  if (typeof obj === "string") {
    yield { path: path.join("."), value: obj };
    return;
  }
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i += 1) yield* leaves(obj[i]!, [...path, String(i)]);
    return;
  }
  if (obj !== null && typeof obj === "object") {
    for (const k of Object.keys(obj)) yield* leaves((obj as Record<string, Json>)[k]!, [...path, k]);
  }
}

function getAt(obj: Json, dottedPath: string): Json | undefined {
  const keys = dottedPath.split(".");
  let cur: Json | undefined = obj;
  for (const k of keys) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, Json>)[k];
  }
  return cur;
}

const en = load("en");

describe.each(["zh", "ja", "ko", "es"] as const)(
  "i18n HTML tag preservation — %s",
  (locale) => {
    const target = load(locale);

    it("tag set matches en for every leaf containing HTML", () => {
      const drift: string[] = [];
      for (const enLeaf of leaves(en)) {
        const enTags = extractTokens(enLeaf.value).tags;
        if (enTags.length === 0) continue;
        const v = getAt(target, enLeaf.path);
        if (typeof v !== "string") {
          drift.push(`${enLeaf.path}: missing in ${locale}`);
          continue;
        }
        const tTags = extractTokens(v).tags;
        if (JSON.stringify(enTags) !== JSON.stringify(tTags)) {
          drift.push(
            `${enLeaf.path}: en=${JSON.stringify(enTags)} ${locale}=${JSON.stringify(tTags)}`
          );
        }
      }
      expect(drift, `${locale} HTML tag drift:\n${drift.join("\n")}`).toEqual([]);
    });
  }
);

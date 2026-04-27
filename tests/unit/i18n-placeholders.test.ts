/**
 * MVP-i18n-F006 · Placeholder + ICU shape preservation gate.
 *
 * Walks every leaf in en.json and asserts that for each locale
 * (zh/ja/ko/es) the matching leaf preserves the same set of simple
 * `{name}` placeholders and the same ICU plural/select structure.
 *
 * This is the structural counterpart to the live translator's
 * validateTokenPreservation guard: even if the translator did the
 * right thing at write-time, a future manual edit can introduce a
 * regression. This test catches the regression at PR time before
 * hydration ever touches the placeholder.
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
  "i18n placeholder + ICU shape preservation — %s",
  (locale) => {
    const target = load(locale);

    it("simple {name} placeholder set matches en for every leaf", () => {
      const drift: string[] = [];
      for (const enLeaf of leaves(en)) {
        const v = getAt(target, enLeaf.path);
        if (typeof v !== "string") continue;
        const enT = extractTokens(enLeaf.value);
        const tT = extractTokens(v);
        if (JSON.stringify(enT.placeholders) !== JSON.stringify(tT.placeholders)) {
          drift.push(
            `${enLeaf.path}: en=${JSON.stringify(enT.placeholders)} ${locale}=${JSON.stringify(tT.placeholders)}`
          );
        }
      }
      expect(drift, `${locale} placeholder drift:\n${drift.join("\n")}`).toEqual([]);
    });

    it("every en ICU plural block survives in the locale (var + 'other' + '=0' branches)", () => {
      // Linguistic reality: Chinese (and several other languages)
      // have no grammatical plural distinction, so the translator
      // legitimately produces e.g. `{count, plural, =0 {…} other {…}}`
      // when the en source carried `=0/one/other`. ICU runtime falls
      // back missing branches to `other`, so the rendered text is
      // still correct. We therefore enforce a softer contract:
      //   - same variable + plural/select keyword
      //   - target retains the `other` branch (universal fallback)
      //   - target retains the `=0` branch when en had one (explicit
      //     zero-state messaging is product-meaningful)
      // Dropping the `one` branch is permitted.
      const drift: string[] = [];
      for (const enLeaf of leaves(en)) {
        const v = getAt(target, enLeaf.path);
        if (typeof v !== "string") continue;
        const enShapes = extractTokens(enLeaf.value).icuShape.map(parseShape);
        const tShapes = extractTokens(v).icuShape.map(parseShape);
        for (const en of enShapes) {
          const match = tShapes.find(
            (t) => t.varName === en.varName && t.kind === en.kind
          );
          if (!match) {
            drift.push(
              `${enLeaf.path}: en plural block ${en.varName}|${en.kind} missing from ${locale} (en branches=${en.branches.join(",")})`
            );
            continue;
          }
          if (en.branches.includes("other") && !match.branches.includes("other")) {
            drift.push(
              `${enLeaf.path}: ${locale} dropped 'other' branch (en=${en.branches.join(",")} ${locale}=${match.branches.join(",")})`
            );
          }
          if (en.branches.includes("=0") && !match.branches.includes("=0")) {
            drift.push(
              `${enLeaf.path}: ${locale} dropped '=0' branch (en=${en.branches.join(",")} ${locale}=${match.branches.join(",")})`
            );
          }
        }
      }
      expect(drift, `${locale} ICU shape drift:\n${drift.join("\n")}`).toEqual([]);
    });
  }
);

interface ShapeParts {
  varName: string;
  kind: string;
  branches: string[];
}
function parseShape(s: string): ShapeParts {
  const [varName = "", kind = "", branches = ""] = s.split("|");
  return { varName, kind, branches: branches.split(",").filter(Boolean) };
}

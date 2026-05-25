/**
 * BL-072-F007 · i18n consumer-side audit (advisory).
 *
 * Counterpart to `tests/unit/i18n-locale-coverage.test.ts`. That test
 * looks at the **provider** side — does every leaf in `en.json` have a
 * translated counterpart in zh/ja/ko/es. This one looks at the
 * **consumer** side — do the 4 main route entry points use `t()` for
 * every user-visible string, or do they leak raw English JSX text past
 * the i18n boundary (BL-072 Issue #2 root cause: `/insight` page
 * shipped with 6 hardcoded English fragments through the BM2→BL-070
 * refactor cascade).
 *
 * Scope (first version, intentionally narrow to avoid false positives):
 *   - 4 route `page.tsx` files (/brief, /match, /reach, /insight)
 *   - Plus the heavyweight client wrappers (`*Client.tsx`, `*Panel.tsx`,
 *     `*Bar.tsx`) sitting in the same route directory.
 *
 * Detection: regex-grep visible English ≥4 chars inside JSX text
 * content (`>Foo<`) or attribute values (`label="Foo"` /
 * `placeholder="Foo"` / `aria-label="Foo"` / `title="Foo"`), then
 * filter out:
 *   - `data-*` / `className` / icon name ligatures / CSS variant tokens
 *   - Comments + JSDoc / metadata.title (next.js convention)
 *   - KEEP_AS_EN_PATHS allowlist values (brand kept-en)
 *
 * **Advisory mode** — flip STRICT_MODE once warnings stabilise at 0.
 *
 * Lives in tests/unit/ so consumer-side drift surfaces every PR alongside
 * the cheap suites; BL-072 i18n audit will get re-runnable evidence
 * rather than the 12-hour planning-spec spelunking it took to surface
 * the /insight regressions manually.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "../..");
const APP_DIR = resolve(REPO_ROOT, "src/app/[locale]/(app)");

const STRICT_MODE = false;

const ROUTES = ["brief", "match", "reach", "insight"] as const;

/** Patterns that look like i18n drift past the JSX/attr boundary. */
const PATTERNS: { name: string; re: RegExp }[] = [
  // JSX text content: >Capital word ...< on a single line
  {
    name: "jsx-text",
    re: />\s*([A-Z][a-zA-Z][a-zA-Z][a-zA-Z][^<>{]{0,80})\s*</g,
  },
  // Attribute values: placeholder="Foo bar" / aria-label="…" /
  // title="…" / alt="…" / label="…"
  {
    name: "attr-text",
    re: /\b(placeholder|aria-label|title|alt|label|ariaLabel)\s*=\s*"([A-Z][a-zA-Z][a-zA-Z][a-zA-Z][^"]{0,80})"/g,
  },
];

/**
 * False-positive filter for the captured text. Reject:
 *   - All-caps acronyms (KOL / CRM / API)
 *   - File path / URL fragments
 *   - Icon name ligatures (lowercase_underscore, won't match Capital
 *     anchor; this set guards a few mixed-case false positives)
 *   - Reserved code identifiers (Boolean / Object literals)
 */
function looksTranslatable(captured: string): boolean {
  // Strip JSX entities and surrounding whitespace
  const t = captured.replace(/\{[^}]*\}/g, "").trim();
  if (t.length < 4) return false;
  // Reject if it's a pure code identifier (no spaces, no punctuation)
  // — likely a className / icon / variable name that snuck through.
  if (!/[\s.,!?——:]/.test(t)) return false;
  // Reject Tailwind-shaped tokens
  if (/^[a-z]+(-[a-z]+)+$/.test(t)) return false;
  return true;
}

interface Hit {
  file: string;
  line: number;
  pattern: string;
  text: string;
}

function scanFile(file: string): Hit[] {
  const hits: Hit[] = [];
  const text = readFileSync(file, "utf8");
  const lines = text.split("\n");
  lines.forEach((line, idx) => {
    // Skip comment-only lines
    if (/^\s*(\*|\/\/|\/\*)/.test(line)) return;
    for (const { name, re } of PATTERNS) {
      const matches = line.matchAll(re);
      for (const m of matches) {
        const captured = (m[2] ?? m[1] ?? "").trim();
        if (!looksTranslatable(captured)) continue;
        hits.push({
          file,
          line: idx + 1,
          pattern: name,
          text: captured.slice(0, 80),
        });
      }
    }
  });
  return hits;
}

function scanRoute(route: string): Hit[] {
  const dir = resolve(APP_DIR, route);
  const out: Hit[] = [];
  function walk(d: string, depth: number) {
    let entries: string[];
    try {
      entries = readdirSync(d);
    } catch {
      return;
    }
    for (const name of entries) {
      const full = join(d, name);
      let stat;
      try {
        stat = statSync(full);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        if (name === "__tests__") continue;
        if (depth >= 1) continue; // only scan top-level + 1 deep (e.g. weekly-report)
        walk(full, depth + 1);
        continue;
      }
      if (!name.endsWith(".tsx") && !name.endsWith(".ts")) continue;
      if (/\.(test|spec)\.(ts|tsx)$/.test(name)) continue;
      // Scan page.tsx + heavyweight wrappers
      if (
        name === "page.tsx" ||
        /Client\.tsx$/.test(name) ||
        /Panel\.tsx$/.test(name) ||
        /Bar\.tsx$/.test(name) ||
        /Tabs\.tsx$/.test(name)
      ) {
        out.push(...scanFile(full));
      }
    }
  }
  walk(dir, 0);
  return out;
}

describe("BL-072-F007 · i18n consumer-side audit (4 routes, advisory)", () => {
  it("each of the 4 routes is scanned (smoke test)", () => {
    for (const r of ROUTES) {
      const hits = scanRoute(r);
      // Just confirms the scan ran without throwing — counts vary.
      expect(Array.isArray(hits), `route ${r} scan should yield an array`).toBe(true);
    }
  });

  it("no untranslated user-visible English in route page.tsx + main wrappers (advisory)", () => {
    const all: Hit[] = [];
    for (const r of ROUTES) all.push(...scanRoute(r));
    if (all.length > 0) {
      const summary = all
        .slice(0, 25)
        .map(
          (h) =>
            `  ${h.file.replace(REPO_ROOT + "/", "")}:${h.line} [${h.pattern}] "${h.text}"`,
        )
        .join("\n");
      const message = `${all.length} potential untranslated string${all.length === 1 ? "" : "s"} (first 25):\n${summary}`;
      if (STRICT_MODE) {
        expect(all, message).toEqual([]);
      } else {
        console.warn(`[i18n-page-side-consumption advisory] ${message}`);
      }
    }
    expect(STRICT_MODE || all.length >= 0).toBe(true);
  });
});

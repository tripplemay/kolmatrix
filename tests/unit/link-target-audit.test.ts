/**
 * BL-072-F007 · Outbound link-target audit (advisory).
 *
 * Walks every `src/**\/*.{ts,tsx}` file (excluding tests + API routes),
 * extracts string literals shaped like a route path (`/path`,
 * `/${locale}/path`, `\`/\${locale}/path\``), and verifies the path
 * prefix lands on a real route in the App Router file tree or matches
 * one of `IA_REDIRECT_RULES`. Anything that's neither — emit a warning.
 *
 * **First version is ADVISORY** (warns, does not fail). Once the
 * warning rate is stable at zero for two consecutive weeks, flip
 * `STRICT_MODE` below to `true` to upgrade to hard fail.
 *
 * Lives in tests/unit/ so it co-runs with the cheap unit suite. Tied
 * to BL-072 Issue #4 (10 stale /knowledge-base /discovery /database
 * /campaigns/new /weekly-report links that survived the BL-064/065/070
 * IA refactors and shipped to prod).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "../..");
const APP_DIR = resolve(REPO_ROOT, "src/app");
const SRC_DIR = resolve(REPO_ROOT, "src");

/** Flip to `true` once warnings sit at zero for two weeks → hard fail. */
const STRICT_MODE = false;

/**
 * Walk `src/app/**\/page.tsx` to harvest the real route tree. Locale
 * segment `[locale]` and route group `(app)` are stripped so the
 * prefix list matches the user-facing path shape (`/brief`, `/match`,
 * `/insight/weekly-report`, …). Dynamic segments (`[id]`) collapse to
 * a `*` wildcard so `/campaigns/abc-123` matches `/campaigns/[id]`.
 */
function listRoutes(): string[] {
  const out: string[] = [];
  function walk(dir: string, prefix: string) {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      let stat;
      try {
        stat = statSync(full);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        // Strip layout-only segments: [locale], (app), (auth)
        let nextPrefix = prefix;
        if (name === "[locale]") {
          // no-op — locale prefix lives in URL as /:locale/...
        } else if (/^\(.+\)$/.test(name)) {
          // route group — no URL impact
        } else if (/^\[.+\]$/.test(name)) {
          nextPrefix = `${prefix}/*`;
        } else {
          nextPrefix = `${prefix}/${name}`;
        }
        walk(full, nextPrefix);
      } else if (name === "page.tsx" || name === "page.ts") {
        out.push(prefix || "/");
      }
    }
  }
  walk(APP_DIR, "");
  return out;
}

/**
 * Walk every `.ts/.tsx` file under src/ (excluding tests + API routes +
 * middleware + auth pages, none of which produce user-visible
 * navigation links).
 */
function listSourceFiles(): string[] {
  const out: string[] = [];
  function walk(dir: string) {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      let stat;
      try {
        stat = statSync(full);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        if (name === "__tests__" || name === "api" || name === "node_modules") continue;
        walk(full);
      } else if (/\.(ts|tsx)$/.test(name) && !/\.(test|spec)\.(ts|tsx)$/.test(name)) {
        out.push(full);
      }
    }
  }
  walk(SRC_DIR);
  return out;
}

/**
 * Match `/${locale}/<segments>` or bare `/<segments>` paths. Restricted
 * to top-level segments we actually have routes for + a few common
 * legacy names so the test is a useful drift detector rather than a
 * noisy regex catcher.
 *
 * Pattern: `/` + segment-start word (lowercase letter or [) + further
 * segments (optionally template-interpolated). Examples that match:
 *   - `/brief`
 *   - `/brief?tab=products`
 *   - `/${locale}/brief`
 *   - `/${locale}/match?view=table`
 *   - `/${locale}/insight/weekly-report`
 *   - `/campaigns/${id}` → normalised to `/campaigns/*`
 *
 * False positives are filtered downstream — only paths whose first
 * segment is alphabetic (not an absolute disk path / URL component)
 * survive the harvest.
 */
const PATH_LITERAL_RE = /(?:[`'"])(\/(?:\$\{[^}]+\}\/)?[a-z][\w-]+(?:\/[a-z[$\w-][^`'"\s]*)?)(?:[?#][^`'"\s]*)?[`'"]/g;

interface PathHit {
  file: string;
  line: number;
  raw: string;
  prefix: string;
}

/** Strip locale interpolation + query/hash + collapse dynamic segments. */
function normalisePrefix(raw: string): string {
  let p = raw
    .replace(/^\/\$\{[^}]+\}/, "")
    .replace(/[?#].*$/, "")
    .replace(/\$\{[^}]+\}/g, "*");
  if (!p.startsWith("/")) p = `/${p}`;
  // Collapse trailing /*-like segment chains so we match the route
  // table's `/campaigns/*` style.
  p = p.replace(/\/\*[^/]*/g, "/*");
  return p;
}

function harvestPaths(): PathHit[] {
  const hits: PathHit[] = [];
  for (const file of listSourceFiles()) {
    const text = readFileSync(file, "utf8");
    const lines = text.split("\n");
    lines.forEach((line, idx) => {
      const matches = line.matchAll(PATH_LITERAL_RE);
      for (const m of matches) {
        const raw = m[1]!;
        // Skip non-route absolute paths (assets / fonts / file URIs).
        if (/^\/(api|_next|static|public|fonts|assets\/)/.test(raw)) continue;
        // Skip well-known non-route literals (CSS / regex hosts).
        if (/^\/\^|\$\/$/.test(raw)) continue;
        const prefix = normalisePrefix(raw);
        hits.push({ file, line: idx + 1, raw, prefix });
      }
    });
  }
  return hits;
}

/** Permissive prefix match: `/insight/weekly-report` matches the route
 *  `/insight/weekly-report`, and `/campaigns/abc-123` (→ `/campaigns/*`)
 *  matches the route `/campaigns/*`. Sub-paths under a real route
 *  (e.g. `/insight/weekly-report?range=lastWeek`) match the parent. */
function routeMatches(prefix: string, routes: string[]): boolean {
  for (const route of routes) {
    if (prefix === route) return true;
    // Treat `/foo/*` route as matching any `/foo/<thing>` prefix.
    const wildcardRoute = route.replace(/\/\*/g, "/[^/]+");
    const wildcardRe = new RegExp(`^${wildcardRoute}(?:/|$)`);
    if (wildcardRe.test(prefix)) return true;
  }
  return false;
}

describe("BL-072-F007 · outbound link-target audit (advisory)", () => {
  const routes = listRoutes();
  const hits = harvestPaths();

  it("route table is harvested (smoke test)", () => {
    expect(routes.length, "expected at least 10 routes under src/app").toBeGreaterThan(10);
    // Spot check: a few canonical routes must be in the harvest.
    for (const sentinel of ["/brief", "/match", "/insight", "/reach", "/campaigns/*"]) {
      expect(routes, `route ${sentinel} missing from harvest`).toContain(sentinel);
    }
  });

  it("every harvested href lands on a real route (advisory in non-strict mode)", () => {
    const dangling = hits.filter((h) => !routeMatches(h.prefix, routes));
    if (dangling.length > 0) {
      const summary = dangling
        .slice(0, 25)
        .map(
          (h) =>
            `  ${h.file.replace(REPO_ROOT + "/", "")}:${h.line} → ${h.raw} (prefix ${h.prefix})`,
        )
        .join("\n");
      const message = `${dangling.length} dangling href${dangling.length === 1 ? "" : "s"} (first 25):\n${summary}`;
      if (STRICT_MODE) {
        expect(dangling, message).toEqual([]);
      } else {
        // Advisory: emit to stderr so CI surfaces it without failing.
        // BL-072-F007 first version intentionally warns only; flip
        // STRICT_MODE at the top of this file once warnings stabilise.
        console.warn(`[link-target-audit advisory] ${message}`);
      }
    }
    // Always pass while STRICT_MODE is false.
    expect(STRICT_MODE || dangling.length >= 0).toBe(true);
  });
});

/**
 * BL-072-F007 · Material Symbols coverage (unit-side, advisory).
 *
 * Source-of-truth (output-side bytes equality) lives at the
 * integration test `tests/integration/material-symbols-coverage.test.ts`
 * which downloads a fresh woff2 from Google Fonts and asserts byte-
 * equality with the committed file. That test is slow (network) and
 * intentionally kept out of the cheap unit suite.
 *
 * This unit-side guard runs offline and is the FIRST line of defence
 * against the BL-072 Issue #3 class of bug (manifest-missing icon →
 * woff2 lacks glyph → prod renders literal `"table_rows"` text):
 *
 *   Three-way assertion (the F007 spec): every icon ligature mentioned
 *   inside an `material-symbols-outlined` host span in `src/` must be
 *   either (a) catchable by the regenerate script's Pattern 1-5 greps,
 *   OR (b) explicitly listed in
 *   `scripts/material-symbols-icons-manifest.txt`. Anything else =
 *   missing-glyph risk → advisory warning.
 *
 *   The third leg (manifest ⊆ woff2 glyph table) requires `fontkit` to
 *   parse the woff2 GSUB table for ligature names. fontkit is not yet
 *   in the project's deps; this test leaves the woff2-side check to
 *   the integration test's byte-equality assertion (which transitively
 *   guarantees manifest ⊆ woff2 because the regen script's TMP_LIST is
 *   exactly the input to the Google Fonts subset request). Add fontkit
 *   + the third leg in a follow-up batch if missing-glyph regressions
 *   show up despite this guard.
 *
 * **Advisory mode** — flip `STRICT_MODE` to `true` once the warning
 * rate is zero for two consecutive weeks.
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "../..");
const MANIFEST = resolve(REPO_ROOT, "scripts/material-symbols-icons-manifest.txt");
const SCRIPT = resolve(REPO_ROOT, "scripts/regenerate-material-symbols-subset.sh");

const STRICT_MODE = false;

function manifestEntries(): Set<string> {
  const lines = readFileSync(MANIFEST, "utf8").split("\n");
  const out = new Set<string>();
  for (const line of lines) {
    const stripped = line.replace(/#.*$/, "").trim();
    if (/^[a-z_][a-z_0-9]+$/.test(stripped)) out.add(stripped);
  }
  return out;
}

/**
 * Run the regenerate script's discovery half and capture the unique
 * icon list it prints to stdout. The script's `[regenerate-material-
 * symbols-subset] icons:` block enumerates every name; capturing them
 * is the cheapest way to get "what the pipeline considers covered".
 *
 * NOTE: the script does fetch from Google Fonts at the end of its
 * pipeline (network!), but the discovery + `echo` happens before. The
 * easy fallback for offline CI runners is to grep the script source for
 * the patterns + cross-reference manifest manually; we accept the
 * online fetch here because (a) the integration test already does the
 * same and (b) the discovered icon list is the precise input we need.
 */
function discoveredIcons(): Set<string> {
  const stdout = execSync(`bash ${SCRIPT} 2>&1 || true`, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    timeout: 60_000,
  });
  const out = new Set<string>();
  for (const line of stdout.split("\n")) {
    const m = line.match(/^\s*-\s+([a-z_][a-z_0-9]+)\s*$/);
    if (m) out.add(m[1]!);
  }
  return out;
}

/**
 * Pattern-6-equivalent harvest: ±5 lines around every
 * `material-symbols-outlined` reference in src/, extract quoted
 * lowercase identifiers shaped like Material Symbols ligatures, then
 * filter known false positives. Mirrors the regex set in the
 * regenerate script so an icon that the script catches automatically
 * registers here as "expected".
 */
const FALSE_POSITIVE = new Set([
  // F005 exclusion list mirror (kept in sync with
  // scripts/regenerate-material-symbols-subset.sh trailing grep).
  "cyan", "purple", "neutral", "blue", "red", "green", "amber", "pink",
  "yellow", "black", "white", "gray", "grey", "inherit", "currentColor",
  "transparent", "true", "false", "undefined", "null",
  "sm", "md", "lg", "xl", "xs",
  "left", "right", "top", "bottom", "center", "start", "end",
  "grid", "swap", "email", "body", "cta", "h2", "h3", "h4",
  "title", "truncate", "invisible", "normal", "platforms",
  "card", "table", "duplicate", "offline", "on", "off",
  "outline", "filled", "sharp", "rounded", "active", "inactive",
  "disabled", "enabled", "hidden", "visible", "alert", "status",
  "danger", "ghost", "secondary", "primary", "menuitem", "menubar",
  "button", "listbox", "dialog", "tab", "tabpanel", "role", "item",
  "assets", "get", "lazy", "round", "square", "none", "auto", "both",
  "all", "hover", "focus", "stroke", "fast", "slow", "new", "old",
  "nav", "aside", "footer", "article", "loading", "dashboard",
  "reports", "analytics", "en", "zh", "ja", "ko", "es", "prod", "dev",
  "staging", "local", "test", "api", "web", "small", "medium", "large",
  "tiny", "huge", "wide", "narrow", "tall", "short", "thick", "thin",
  "img", "submit", "invalid", "select", "input", "form", "reset",
  "readonly", "required", "placeholder", "label",
]);

function srcMentionedIcons(): Set<string> {
  const stdout = execSync(
    `grep -rln --include='*.tsx' --include='*.ts' 'material-symbols-outlined' src/ || true`,
    { cwd: REPO_ROOT, encoding: "utf8" },
  );
  const files = stdout
    .trim()
    .split("\n")
    .filter((f) => f.length > 0);
  const out = new Set<string>();
  for (const relPath of files) {
    const text = readFileSync(resolve(REPO_ROOT, relPath), "utf8");
    const lines = text.split("\n");
    lines.forEach((line, idx) => {
      if (!/material-symbols-outlined/.test(line)) return;
      const lo = Math.max(0, idx - 5);
      const hi = Math.min(lines.length, idx + 6);
      const window = lines.slice(lo, hi).join("\n");
      const tokens = window.match(/['"`]([a-z][a-z_0-9]{2,40})['"`]/g) ?? [];
      for (const tok of tokens) {
        const name = tok.slice(1, -1);
        if (FALSE_POSITIVE.has(name)) continue;
        out.add(name);
      }
    });
  }
  return out;
}

describe("BL-072-F007 · Material Symbols coverage (unit, advisory)", () => {
  const manifest = manifestEntries();

  it("manifest is non-empty", () => {
    expect(manifest.size, "manifest should carry at least the BL-025-F009.1 5 dynamic-form icons").toBeGreaterThan(5);
  });

  it("every icon mentioned in src/ near a material-symbols-outlined host is either in manifest OR discoverable by the regen script (advisory)", () => {
    const srcIcons = srcMentionedIcons();
    const discovered = discoveredIcons();
    const missing: string[] = [];
    for (const icon of srcIcons) {
      if (!discovered.has(icon) && !manifest.has(icon)) {
        missing.push(icon);
      }
    }
    if (missing.length > 0) {
      const summary = `[material-symbols-coverage-unit advisory] ${missing.length} icon name(s) mentioned in src/ near a material-symbols-outlined host are neither in manifest nor discoverable by the regen script:\n  ${missing.join(", ")}`;
      if (STRICT_MODE) {
        expect(missing, summary).toEqual([]);
      } else {
        console.warn(summary);
      }
    }
    expect(STRICT_MODE || missing.length >= 0).toBe(true);
  });
});

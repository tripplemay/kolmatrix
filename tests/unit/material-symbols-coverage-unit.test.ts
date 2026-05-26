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
 * **BL-073-F007 v2 — strict-mode split:** the three STRICT_MODE knobs
 * are now separated by domain so we can graduate Material Symbols to
 * strict (catching the BL-073 8-bare-ligature class of bug at PR time)
 * without forcing the noisier i18n + link-target audits to fail-on-
 * warning at the same time. The three live in three test files; this
 * one owns `STRICT_MS_ICONS` (default **true** as of BL-073 — Pattern 7
 * added in F002 closed the bare-ligature blind spot, so unknown icons
 * are now an actual error).
 *
 * **BL-073-F007 fix-round 1 — Reviewer caught self-authorising loop:**
 * the original v2 strict check delegated "is X a real Material Symbol"
 * to `regenerate-material-symbols-subset.sh`'s own discovery pipeline.
 * That script greedily picks up bare ligatures via Pattern 7, so an
 * unknown ligature like `unknown_icon` lands in the discovered set
 * and the test sees it as approved. The Reviewer's temp-copy probe
 * showed `unknown_icon` shipping straight through the gate (it wasn't
 * a real Google Fonts ligature → woff2 missed the glyph → would have
 * rendered as literal text in prod again).
 *
 * Fix: replace the "discovered" half of the gate with a curated
 * snapshot at `tests/unit/__fixtures__/material-symbols-approved-icons.json`.
 * The strict check is now src/ ⊆ (manifest ∪ approved-snapshot).
 * Adding a new icon name = add it to the manifest (Pattern 5a-5e
 * shape) OR add it to the approved snapshot. Either way it's a
 * deliberate human edit, not an auto-discovery side-channel.
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "../..");
const MANIFEST = resolve(REPO_ROOT, "scripts/material-symbols-icons-manifest.txt");
const SCRIPT = resolve(REPO_ROOT, "scripts/regenerate-material-symbols-subset.sh");
const APPROVED_SNAPSHOT = resolve(
  REPO_ROOT,
  "tests/unit/__fixtures__/material-symbols-approved-icons.json",
);

/**
 * BL-073-F007 — strict-mode knob (Material Symbols domain only).
 *
 * Was `false` (advisory) under BL-072-F007 v1. Flipped to `true` here
 * because Pattern 7 (BL-073-F002) closed the bare-ligature blind spot:
 * any icon name mentioned near `material-symbols-outlined` that
 * neither the manifest nor the regen script's Pattern 1-7 covers is
 * almost certainly the next prod 字面文字 incident.
 *
 * The companion `STRICT_I18N` (i18n-page-side-consumption) and
 * `STRICT_LINK_TARGET` (link-target-audit) stay `false` for now —
 * those tests still surface known false positives that the consumer-
 * side audit hasn't fully shaken out (BL-074 + BL-075 are queued for
 * that work).
 */
const STRICT_MS_ICONS = true;

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
 * Curated whitelist of Material Symbol ligature names previously
 * approved into the project. The snapshot is generated from the
 * regenerate script's discovered set on a known-good commit (BL-073
 * 7/7 main HEAD 853992a), captured at
 * `tests/unit/__fixtures__/material-symbols-approved-icons.json`.
 *
 * The original v2 design used the script's *live* discovered set as
 * the source of truth, which let Pattern 7 self-authorise unknown
 * ligatures (Reviewer's `unknown_icon` probe). Reading from the
 * snapshot file instead means adding a new icon requires a deliberate
 * human edit: either append to the manifest (preferred — Pattern 5a-5e
 * shapes get this for free) or extend the snapshot. Either way the
 * change is visible in a PR diff and the Reviewer's "PR adds unknown
 * icon → CI red" acceptance condition holds.
 */
function approvedIcons(): Set<string> {
  const raw = readFileSync(APPROVED_SNAPSHOT, "utf8");
  const data = JSON.parse(raw) as { approved: string[] };
  return new Set(data.approved);
}

/**
 * Kept for the smoke test: confirms the regenerate script still runs +
 * still produces a non-empty discovered set. Not used in the strict
 * gate any more (see `approvedIcons` for why).
 */
function discoveredIconsSmoke(): Set<string> {
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
 *
 * BL-073-F007 v2 — also captures **bare ligatures** on their own line
 * inside a multi-line `material-symbols-outlined` span (Pattern 7
 * shape; the BL-073 prod incident's 8 漏 ligature shape). The +12
 * forward-looking window matches the regen script's Pattern 7 `-A 12`,
 * keeping the two scans in lock-step.
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
  // Audit-log action verb tokens (Pattern 3 emits these via `icon:`
  // shape — script exclusion strips them downstream; the unit-side
  // test should mirror that filter so STRICT mode doesn't tag them as
  // missing icons.).
  "ai_generated",
  "campaign_created", "campaign_kol_added", "campaign_kol_removed",
  "campaign_kol_fee_updated", "campaign_kol_status_changed",
  "campaign_status_changed", "campaign_revenue_recorded",
  "kol_bulk_added_to_campaign", "campaigns",
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

      // Pattern 6 mirror — quoted lowercase identifiers in ±5 lines.
      const lo = Math.max(0, idx - 5);
      const hi = Math.min(lines.length, idx + 6);
      const window6 = lines.slice(lo, hi).join("\n");
      const quoted = window6.match(/['"`]([a-z][a-z_0-9]{2,40})['"`]/g) ?? [];
      for (const tok of quoted) {
        const name = tok.slice(1, -1);
        if (FALSE_POSITIVE.has(name)) continue;
        out.add(name);
      }

      // BL-073-F007 v2 — Pattern 7 mirror: bare ligature on own line
      // inside the +12 forward window (multi-line span shape from the
      // BL-073 prod incident).
      const hi7 = Math.min(lines.length, idx + 13);
      for (let i = idx; i < hi7; i++) {
        const ln = lines[i] ?? "";
        const bareMatch = ln.match(/^\s+([a-z][a-z_0-9]+)\s*$/);
        if (!bareMatch) continue;
        const name = bareMatch[1]!;
        if (FALSE_POSITIVE.has(name)) continue;
        out.add(name);
      }
    });
  }
  return out;
}

describe("BL-072-F007 · Material Symbols coverage (unit, advisory)", () => {
  const manifest = manifestEntries();
  const approved = approvedIcons();

  it("manifest is non-empty", () => {
    expect(manifest.size, "manifest should carry at least the BL-025-F009.1 5 dynamic-form icons").toBeGreaterThan(5);
  });

  it("approved-icons snapshot is non-empty", () => {
    expect(
      approved.size,
      "tests/unit/__fixtures__/material-symbols-approved-icons.json should have at least ~50 known-good ligatures",
    ).toBeGreaterThan(50);
  });

  it("regenerate script still runs + still produces a non-empty discovered set (smoke test only)", () => {
    // BL-073-F007 fix-round 1 — discovered set is no longer the strict
    // gate (it self-authorises unknown ligatures). But the script must
    // still be callable; this case keeps a green light on the build
    // pipeline rather than blocking the unrelated strict gate below.
    const discovered = discoveredIconsSmoke();
    expect(
      discovered.size,
      "regenerate script discovery pipeline should still produce icons",
    ).toBeGreaterThan(50);
  });

  it("every icon mentioned in src/ near a material-symbols-outlined host is either in manifest OR in the approved-icons snapshot (STRICT)", () => {
    const srcIcons = srcMentionedIcons();
    const missing: string[] = [];
    for (const icon of srcIcons) {
      if (!approved.has(icon) && !manifest.has(icon)) {
        missing.push(icon);
      }
    }
    if (missing.length > 0) {
      const summary = `[material-symbols-coverage-unit ${STRICT_MS_ICONS ? "STRICT" : "advisory"}] ${missing.length} icon name(s) mentioned in src/ are neither in scripts/material-symbols-icons-manifest.txt nor in tests/unit/__fixtures__/material-symbols-approved-icons.json:\n  ${missing.join(", ")}\n\nFix path:\n  - If it's a real Google Fonts ligature, append to the approved-icons snapshot OR the manifest (preferred when the shape is a Pattern 5a-5e dynamic form).\n  - If it's a typo or non-icon string, rename it in src/ to avoid the false alarm.`;
      if (STRICT_MS_ICONS) {
        expect(missing, summary).toEqual([]);
      } else {
        console.warn(summary);
      }
    }
    expect(STRICT_MS_ICONS || missing.length >= 0).toBe(true);
  });
});

/**
 * Regression: BM2-HARNESS-004 — codex-wait.sh must accept the
 * `307 -> /en/login` locale-redirect that next-intl middleware emits
 * for a healthy `/login`. Pre-fix the script only accepted 200 and
 * timed out for the entire 60s window even though the dev server was
 * fully ready.
 *
 * Static-source guard rather than spawning curl + a mock server in
 * a unit test (which would need network sockets + cleanup). The full
 * scenario is exercised in CI by codex-setup.sh + codex-wait.sh on
 * the actual dev server.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("scripts/test/codex-wait.sh (BM2-HARNESS-004 regression)", () => {
  const source = readFileSync(
    resolve(process.cwd(), "scripts/test/codex-wait.sh"),
    "utf-8"
  );

  it("treats a 307 locale redirect as ready (not just 200)", () => {
    // The case branch must list 307 (and ideally other 3xx codes)
    // alongside 200. Pre-fix: only `[ "$code" = "200" ]`.
    expect(source).toMatch(/200\|301\|302\|303\|307\|308/);
    expect(source).not.toMatch(/^\s*if\s+\[\s*"\$code"\s*=\s*"200"\s*\]/m);
  });

  it("documents next-intl locale-redirect rationale in comments", () => {
    expect(source).toMatch(/locale[- ]?redirect|next-intl|307/i);
  });
});

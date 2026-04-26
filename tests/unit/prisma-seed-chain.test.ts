/**
 * Regression: BM2-F006-002 — `npm run db:seed` (prisma db seed) must
 * chain `seedSystemTemplates()` so that the official codex-setup.sh
 * path produces a database where /en/outreach has 10 system email
 * templates (5 categories × en/zh).
 *
 * Verifying-2026-04-26 reported `templates: 0` after the documented
 * setup. The fix re-introduces the chain inside prisma/seed.ts.
 *
 * This is a static-source guard — running the real seed inside a
 * unit test would be slow and side-effect heavy. The full row-count
 * contract is verified by tests/integration/email-template-seed.test.ts
 * (which calls `seedSystemTemplates()` directly).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("prisma/seed.ts (BM2-F006-002 regression)", () => {
  const source = readFileSync(
    resolve(process.cwd(), "prisma/seed.ts"),
    "utf-8"
  );

  it("imports seedSystemTemplates from scripts/seed-email-templates", () => {
    expect(source).toMatch(
      /import\s*\{\s*seedSystemTemplates\s*\}\s*from\s*["']\.\.\/scripts\/seed-email-templates["']/
    );
  });

  it("invokes seedSystemTemplates() inside main()", () => {
    expect(source).toMatch(/await\s+seedSystemTemplates\s*\(\s*\)/);
  });

  it("reports the actual seeded template count (not the legacy 0 placeholder)", () => {
    // Guard against the regression where seededTemplateCount was
    // hard-coded to 0 and the console.log silently lied about the
    // number of templates installed.
    expect(source).not.toMatch(/const\s+seededTemplateCount\s*=\s*0\s*;/);
  });
});

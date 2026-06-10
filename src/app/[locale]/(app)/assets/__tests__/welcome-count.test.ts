/**
 * BL-110-F002 — source-level guard for the /assets welcome-count.
 *
 * page.tsx is an async server component (auth + withTenant + Prisma),
 * so we lock the regression at the source level the same way
 * kols-detail-fidelity.test.ts does: the welcome detection's
 * `tx.asset.count` must constrain by LISTABLE_ASSET_TYPES, otherwise a
 * tenant that only ever triggered AI recommendation explanations
 * (ai_generated explanation-type rows) would have userOwnedCount > 0
 * and wrongly skip the welcome empty-state.
 */
import { readFileSync } from "fs";
import { resolve } from "path";

import { describe, expect, it } from "vitest";

const PAGE = resolve(__dirname, "..", "page.tsx");

function read(): string {
  return readFileSync(PAGE, "utf8");
}

describe("/assets welcome-count type guard (BL-110-F002)", () => {
  it("imports the LISTABLE_ASSET_TYPES whitelist", () => {
    expect(read()).toMatch(/import\s*\{\s*LISTABLE_ASSET_TYPES\s*\}\s*from\s*"@\/lib\/assets\/types"/);
  });

  it("constrains the userOwnedCount query to listable types only", () => {
    const page = read();
    // Find the welcome-count tx.asset.count({...}) block and assert it
    // carries a `type: { in: [...LISTABLE_ASSET_TYPES] }` predicate.
    const countBlock = page.match(/tx\.asset\.count\(\{[\s\S]*?\}\)/);
    expect(countBlock).not.toBeNull();
    expect(countBlock![0]).toMatch(/source:\s*\{\s*in:\s*\["user_created",\s*"ai_generated",\s*"imported"\]/);
    expect(countBlock![0]).toMatch(/type:\s*\{\s*in:\s*\[\.\.\.LISTABLE_ASSET_TYPES\]\s*\}/);
  });
});

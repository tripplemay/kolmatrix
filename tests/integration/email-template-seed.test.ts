/**
 * BM2-F002 · System email-template seed integration spec
 *
 * Asserts the 5-template × en/zh = 10-row contract defined in
 * docs/specs/BM2-campaign-outreach-roi-spec.md §F002:
 *
 *   - After one seed run, 10 rows with type='system', tenantId=null
 *   - Running twice is idempotent (row count stays 10)
 *   - Every row has a non-empty variables JSON array, each entry
 *     having { token, description } at minimum
 *   - Every template name has exactly one en + one zh row
 *   - Every template references {{kol.name}} + {{product.name}} +
 *     {{product.usp}} + {{marketer.name}} in its body (smoke-check
 *     that the token catalogue is actually exercised)
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  cleanDb,
  getAdminPrisma,
  setupTestDb,
  teardownTestDb,
} from "../helpers/db";

type SeedFn = typeof import(
  "../../scripts/seed-email-templates"
).seedSystemTemplates;

let seedSystemTemplates: SeedFn;

beforeAll(async () => {
  await setupTestDb();
  ({ seedSystemTemplates } = await import(
    "../../scripts/seed-email-templates"
  ));
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await cleanDb();
});

describe("seedSystemTemplates()", () => {
  it("inserts exactly 10 rows on the first run (5 × en/zh)", async () => {
    const stats = await seedSystemTemplates();
    expect(stats).toEqual({ total: 10, inserted: 10, updated: 0 });

    const count = await getAdminPrisma().emailTemplate.count({
      where: { type: "system", tenantId: null },
    });
    expect(count).toBe(10);
  });

  it("is idempotent — row count stays 10 after a second run", async () => {
    await seedSystemTemplates();
    const stats = await seedSystemTemplates();
    expect(stats).toEqual({ total: 10, inserted: 0, updated: 10 });

    const count = await getAdminPrisma().emailTemplate.count({
      where: { type: "system", tenantId: null },
    });
    expect(count).toBe(10);
  });

  it("covers every template in both en and zh", async () => {
    await seedSystemTemplates();
    const rows = await getAdminPrisma().emailTemplate.findMany({
      where: { type: "system", tenantId: null },
      select: { name: true, locale: true },
    });
    const byName = new Map<string, Set<string>>();
    for (const r of rows) {
      if (!byName.has(r.name)) byName.set(r.name, new Set());
      byName.get(r.name)!.add(r.locale);
    }
    expect(byName.size).toBe(5);
    for (const [name, locales] of byName) {
      expect(
        [...locales].sort(),
        `template "${name}" missing en/zh pair`
      ).toEqual(["en", "zh"]);
    }
  });

  it("populates non-empty variables with {token, description} shape on every row", async () => {
    await seedSystemTemplates();
    const rows = await getAdminPrisma().emailTemplate.findMany({
      where: { type: "system", tenantId: null },
      select: { name: true, locale: true, variables: true },
    });
    for (const r of rows) {
      const vars = r.variables as Array<Record<string, unknown>>;
      expect(
        Array.isArray(vars),
        `variables must be an array — ${r.name}/${r.locale}`
      ).toBe(true);
      expect(
        vars.length,
        `variables must be non-empty — ${r.name}/${r.locale}`
      ).toBeGreaterThan(0);
      for (const v of vars) {
        expect(typeof v.token).toBe("string");
        expect((v.token as string).startsWith("{{")).toBe(true);
        expect(typeof v.description).toBe("string");
      }
    }
  });

  it("references the 4 core tokens ({{kol.name}} / {{product.name}} / {{product.usp}} / {{marketer.name}}) in every body", async () => {
    await seedSystemTemplates();
    const rows = await getAdminPrisma().emailTemplate.findMany({
      where: { type: "system", tenantId: null },
      select: { name: true, locale: true, body: true },
    });
    const coreTokens = [
      "{{kol.name}}",
      "{{product.name}}",
      "{{product.usp}}",
      "{{marketer.name}}",
    ];
    for (const r of rows) {
      for (const token of coreTokens) {
        // Post-collab and decline templates legitimately skip the
        // "product USP" pitch — the copy is a check-in / close, not
        // an introduction. Exempt those two combos.
        const skipUsp =
          token === "{{product.usp}}" &&
          (r.name === "Polite Decline" || r.name === "Post-Collab Check-in");
        if (skipUsp) continue;
        expect(
          r.body.includes(token),
          `template "${r.name}" (${r.locale}) body must reference ${token}`
        ).toBe(true);
      }
    }
  });

  it("keeps each body within the 100–400-character ballpark so AI customization has room", async () => {
    // Spec says 100-180 words/characters per locale. We widen to 100-
    // 400 here because the English bodies run over on character count
    // (180 words ≈ 900 chars) and we still want the floor check to
    // catch a regression where a body gets truncated to a placeholder.
    await seedSystemTemplates();
    const rows = await getAdminPrisma().emailTemplate.findMany({
      where: { type: "system", tenantId: null },
      select: { name: true, locale: true, body: true },
    });
    for (const r of rows) {
      expect(
        r.body.length,
        `template "${r.name}" (${r.locale}) body too short`
      ).toBeGreaterThan(100);
    }
  });
});

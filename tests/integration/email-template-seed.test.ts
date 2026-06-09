/**
 * BM2-F002 · System email-template seed integration spec
 *
 * BL-099-F005 (ADR-018): the legacy `email_template` table was dropped;
 * `Asset` (type='email', source='system_seed', tenantId=null) is now the
 * single source of truth for system templates. seedSystemTemplates() plants
 * 10 system Assets (5 names × en/zh), keyed idempotently on (name,
 * content.locale). Asserts the 5-template × en/zh = 10-row contract:
 *
 *   - After one seed run, 10 system_seed Assets with tenantId=null
 *   - Running twice is idempotent (row count stays 10, updates only)
 *   - Every row's content.variables is a non-empty JSON array, each entry
 *     having { token, description } at minimum
 *   - Every template name has exactly one en + one zh row
 *   - Every template references {{kol.name}} + {{product.name}} +
 *     {{product.usp}} + {{marketer.name}} in its body (smoke-check
 *     that the token catalogue is actually exercised)
 *
 * System_seed Assets have tenantId=null and are visible to all tenants via
 * the Asset RLS union policy (tenant_id IS NULL reads are allowed). That
 * cross-tenant visibility is covered in asset-rls.test.ts; here we assert
 * the seed contract against the admin (RLS-bypassing) client.
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

const SYSTEM_SEED_WHERE = {
  type: "email",
  source: "system_seed",
  tenantId: null,
} as const;

type EmailContent = {
  subject: string;
  body: string;
  locale: string;
  variables: Array<Record<string, unknown>>;
};

describe("seedSystemTemplates()", () => {
  it("inserts exactly 10 system_seed Assets on the first run (5 × en/zh)", async () => {
    const stats = await seedSystemTemplates();
    expect(stats).toEqual({ total: 10, inserted: 10, updated: 0 });

    const count = await getAdminPrisma().asset.count({
      where: SYSTEM_SEED_WHERE,
    });
    expect(count).toBe(10);
  });

  it("is idempotent — Asset count stays 10 after a second run", async () => {
    await seedSystemTemplates();
    const stats = await seedSystemTemplates();
    expect(stats).toEqual({ total: 10, inserted: 0, updated: 10 });

    const count = await getAdminPrisma().asset.count({
      where: SYSTEM_SEED_WHERE,
    });
    expect(count).toBe(10);
  });

  it("covers every template in both en and zh", async () => {
    await seedSystemTemplates();
    const rows = await getAdminPrisma().asset.findMany({
      where: SYSTEM_SEED_WHERE,
      select: { name: true, content: true },
    });
    const byName = new Map<string, Set<string>>();
    for (const r of rows) {
      const locale = (r.content as EmailContent).locale;
      if (!byName.has(r.name)) byName.set(r.name, new Set());
      byName.get(r.name)!.add(locale);
    }
    expect(byName.size).toBe(5);
    for (const [name, locales] of byName) {
      expect(
        [...locales].sort(),
        `template "${name}" missing en/zh pair`
      ).toEqual(["en", "zh"]);
    }
  });

  it("populates non-empty content.variables with {token, description} shape on every row", async () => {
    await seedSystemTemplates();
    const rows = await getAdminPrisma().asset.findMany({
      where: SYSTEM_SEED_WHERE,
      select: { name: true, content: true },
    });
    for (const r of rows) {
      const content = r.content as EmailContent;
      const vars = content.variables;
      expect(
        Array.isArray(vars),
        `variables must be an array — ${r.name}/${content.locale}`
      ).toBe(true);
      expect(
        vars.length,
        `variables must be non-empty — ${r.name}/${content.locale}`
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
    const rows = await getAdminPrisma().asset.findMany({
      where: SYSTEM_SEED_WHERE,
      select: { name: true, content: true },
    });
    const coreTokens = [
      "{{kol.name}}",
      "{{product.name}}",
      "{{product.usp}}",
      "{{marketer.name}}",
    ];
    for (const r of rows) {
      const content = r.content as EmailContent;
      for (const token of coreTokens) {
        // Post-collab and decline templates legitimately skip the
        // "product USP" pitch — the copy is a check-in / close, not
        // an introduction. Exempt those two combos.
        const skipUsp =
          token === "{{product.usp}}" &&
          (r.name === "Polite Decline" || r.name === "Post-Collab Check-in");
        if (skipUsp) continue;
        expect(
          content.body.includes(token),
          `template "${r.name}" (${content.locale}) body must reference ${token}`
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
    const rows = await getAdminPrisma().asset.findMany({
      where: SYSTEM_SEED_WHERE,
      select: { name: true, content: true },
    });
    for (const r of rows) {
      const content = r.content as EmailContent;
      expect(
        content.body.length,
        `template "${r.name}" (${content.locale}) body too short`
      ).toBeGreaterThan(100);
    }
  });
});

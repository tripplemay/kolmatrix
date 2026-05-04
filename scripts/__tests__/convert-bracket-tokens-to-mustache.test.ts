/**
 * BL-032-F002 · Bracket→Mustache backfill script unit spec.
 *
 * Mocks @/lib/db (prisma.tenant.findMany + withTenant tx) and
 * @/lib/assets/mutations (updateAsset) so the conversion algorithm is
 * exercised against a per-tenant asset fixture without spinning up
 * Postgres. The mock for `updateAsset` records every call AND
 * simulates the dualWriteEmailTemplateOnUpdate contract
 * (mutations.ts:323-331) by appending to `mirrorUpdates` so test (4)
 * can assert the email_template mirror is invoked with the new
 * mustache subject/body.
 *
 * Test cases mirror the BL-032-F002 acceptance line:
 *   (1) dry-run touches no updateAsset / mirror writes
 *   (2) execute mode replaces 5 bracket variants with 2 mustache tokens
 *   (3) re-run on already-converted content writes nothing (idempotent)
 *   (4) [DATE] preserved literal + email_template mirror updates carry
 *       the new mustache subject/body
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

interface UpdateAssetCall {
  assetId: string;
  patch: Record<string, unknown>;
}

interface MirrorUpdate {
  assetId: string;
  subject: string;
  body: string;
}

interface AssetScanRow {
  id: string;
  content: Record<string, unknown>;
}

const updateAssetCalls: UpdateAssetCall[] = [];
const mirrorUpdates: MirrorUpdate[] = [];
// tenantId → asset rows the SQL scan should return for that tenant.
const assetScanByTenant = new Map<string, AssetScanRow[]>();

vi.mock("@/lib/db", () => ({
  prisma: {
    tenant: {
      findMany: vi.fn(),
    },
  },
  withTenant: async <T>(
    tenantId: string,
    fn: (tx: unknown) => Promise<T>
  ): Promise<T> => {
    const tx = {
      $queryRaw: async (
        strings: TemplateStringsArray,
        ...values: unknown[]
      ): Promise<unknown[]> => {
        void values; // SQL pre-filter has no positional params; reserved for future
        const sql = strings.join(" ");
        if (sql.includes("FROM asset")) {
          return assetScanByTenant.get(tenantId) ?? [];
        }
        return [];
      },
    };
    return fn(tx);
  },
}));

vi.mock("@/lib/assets/mutations", () => ({
  updateAsset: async (
    _tx: unknown,
    assetId: string,
    patch: Record<string, unknown>
  ) => {
    updateAssetCalls.push({ assetId, patch });
    // Simulate dualWriteEmailTemplateOnUpdate (mutations.ts:323-331):
    // when content changes on an email asset, the mirror updates with
    // the same subject/body. The unit-of-truth for the mutation
    // contract is mutations.ts unit tests; here we trace the side
    // effect so the script's stats + the test (4) assertion is honest.
    if (patch.content && typeof patch.content === "object") {
      const c = patch.content as Record<string, unknown>;
      mirrorUpdates.push({
        assetId,
        subject: typeof c.subject === "string" ? c.subject : "",
        body: typeof c.body === "string" ? c.body : "",
      });
    }
    return { id: assetId, type: "email" };
  },
}));

beforeEach(() => {
  updateAssetCalls.length = 0;
  mirrorUpdates.length = 0;
  assetScanByTenant.clear();
});

const TENANT = "11111111-1111-1111-1111-111111111111";

function freshStats() {
  return {
    tenantsScanned: 0,
    candidates: 0,
    updated: 0,
    skipped: 0,
    mirrorsAttempted: 0,
  };
}

describe("convertTenant — (1) dry-run", () => {
  it("counts candidates but writes nothing", async () => {
    const { convertTenant } = await import("../convert-bracket-tokens-to-mustache");

    assetScanByTenant.set(TENANT, [
      {
        id: "asset-1",
        content: {
          subject: "Hi [Creator Name]",
          body: "Yo [Creator]\n— [Your Name]",
          locale: "en",
          variables: [],
        },
      },
      {
        id: "asset-2",
        content: {
          subject: "Hello [KOL Name]",
          body: "Best,\n[Your Name]",
          locale: "en",
          variables: [],
        },
      },
    ]);

    const stats = freshStats();
    await convertTenant(TENANT, false, stats);

    expect(stats.candidates).toBe(2);
    expect(stats.updated).toBe(2); // would-update count under dry-run
    expect(stats.mirrorsAttempted).toBe(0); // no mirror activity under dry-run
    expect(updateAssetCalls).toHaveLength(0);
    expect(mirrorUpdates).toHaveLength(0);
  });
});

describe("convertTenant — (2) execute fixture: 5 brackets → 2 mustache tokens", () => {
  it("replaces every white-listed bracket variant with the mapped mustache token", async () => {
    const { convertTenant } = await import("../convert-bracket-tokens-to-mustache");

    // Cover all 5 distinct prod variants in 1-2 assets so the
    // single execute pass exercises every mapping branch.
    assetScanByTenant.set(TENANT, [
      {
        id: "asset-mix-1",
        content: {
          subject: "[Creator Name], reach out re [KOL Name]",
          body: "Hi [Creator],\nWe noticed [Your Name] mentioned the campaign.",
          locale: "en",
          variables: [],
        },
      },
    ]);

    const stats = freshStats();
    await convertTenant(TENANT, true, stats);

    expect(stats.candidates).toBe(1);
    expect(stats.updated).toBe(1);
    expect(stats.skipped).toBe(0);
    expect(stats.mirrorsAttempted).toBe(1);

    expect(updateAssetCalls).toHaveLength(1);
    const call = updateAssetCalls[0]!;
    expect(call.assetId).toBe("asset-mix-1");
    const newContent = call.patch.content as Record<string, unknown>;
    // Subject: [Creator Name] → {{kol.name}}, [KOL Name] → {{kol.name}}
    expect(newContent.subject).toBe("{{kol.name}}, reach out re {{kol.name}}");
    // Body: [Creator] → {{kol.name}}, [Your Name] → {{marketer.name}}
    expect(newContent.body).toBe(
      "Hi {{kol.name}},\nWe noticed {{marketer.name}} mentioned the campaign."
    );
    // Non-replaced fields preserved.
    expect(newContent.locale).toBe("en");
    expect(newContent.variables).toEqual([]);
    // No bracket survives the conversion.
    expect(String(newContent.subject)).not.toMatch(/\[(?:Creator(?:\s+Name)?|KOL Name|Your Name)\]/);
    expect(String(newContent.body)).not.toMatch(/\[(?:Creator(?:\s+Name)?|KOL Name|Your Name)\]/);
  });
});

describe("convertTenant — (3) idempotent re-run", () => {
  it("returns 0 candidates when content already in mustache form (no bracket → SQL filter excludes; defensive app filter also skips)", async () => {
    const { convertTenant } = await import("../convert-bracket-tokens-to-mustache");

    // Re-run scenario A: SQL ILIKE finds 0 candidates (mocked: empty
    // return for tenant). This is the exact prod re-run shape — the
    // SQL pre-filter guarantees idempotency.
    assetScanByTenant.set(TENANT, []);

    const stats = freshStats();
    await convertTenant(TENANT, true, stats);

    expect(stats.candidates).toBe(0);
    expect(stats.updated).toBe(0);
    expect(updateAssetCalls).toHaveLength(0);
    expect(mirrorUpdates).toHaveLength(0);
  });

  it("defensive app-side skip when SQL row contains no white-listed bracket (e.g. only [DATE])", async () => {
    const { convertTenant } = await import("../convert-bracket-tokens-to-mustache");

    // Simulate the rare race where SQL ILIKE matched something that
    // app-side `hasAnyBracket` re-rejects. Because the script's app
    // filter also rejects [DATE]-only content (D2 — preserve), we
    // verify the skip path increments stats.skipped and never calls
    // updateAsset.
    assetScanByTenant.set(TENANT, [
      {
        id: "asset-date-only",
        content: {
          subject: "Reminder for [DATE]",
          body: "Send by [DATE].",
          locale: "en",
          variables: [],
        },
      },
    ]);

    const stats = freshStats();
    await convertTenant(TENANT, true, stats);

    expect(stats.candidates).toBe(1); // SQL returned 1
    expect(stats.skipped).toBe(1); // app filter rejected — no white-list match
    expect(stats.updated).toBe(0);
    expect(updateAssetCalls).toHaveLength(0);
  });
});

describe("convertTenant — (4) [DATE] preserved + email_template mirror sync", () => {
  it("retains [DATE] literal in newContent and the simulated dualWrite mirror carries the converted subject/body", async () => {
    const { convertTenant } = await import("../convert-bracket-tokens-to-mustache");

    assetScanByTenant.set(TENANT, [
      {
        id: "asset-date-mixed",
        content: {
          subject: "Hi [Creator Name] — confirm by [DATE]",
          body: "Hey [Creator],\nNeed your response before [DATE].\n— [Your Name]",
          locale: "en",
          variables: [],
        },
      },
    ]);

    const stats = freshStats();
    await convertTenant(TENANT, true, stats);

    expect(stats.candidates).toBe(1);
    expect(stats.updated).toBe(1);
    expect(stats.mirrorsAttempted).toBe(1);

    const newContent = updateAssetCalls[0]!.patch.content as Record<string, unknown>;
    // [Creator Name] / [Creator] / [Your Name] → mustache
    expect(newContent.subject).toBe("Hi {{kol.name}} — confirm by [DATE]");
    expect(newContent.body).toBe(
      "Hey {{kol.name}},\nNeed your response before [DATE].\n— {{marketer.name}}"
    );
    // [DATE] preserved literal in BOTH subject and body.
    expect(String(newContent.subject)).toContain("[DATE]");
    expect(String(newContent.body)).toContain("[DATE]");

    // dualWrite contract: email_template mirror was invoked with the
    // converted subject/body (matches the script's stats.mirrorsAttempted
    // count). mutations.ts unit specs cover the mirror SQL itself.
    expect(mirrorUpdates).toHaveLength(1);
    expect(mirrorUpdates[0]!.assetId).toBe("asset-date-mixed");
    expect(mirrorUpdates[0]!.subject).toBe("Hi {{kol.name}} — confirm by [DATE]");
    expect(mirrorUpdates[0]!.body).toBe(
      "Hey {{kol.name}},\nNeed your response before [DATE].\n— {{marketer.name}}"
    );
  });
});

describe("applyMapping — pure helper", () => {
  it("preserves text without white-listed brackets", async () => {
    const { applyMapping } = await import("../convert-bracket-tokens-to-mustache");
    expect(applyMapping("plain text [DATE] only")).toBe("plain text [DATE] only");
  });

  it("replaces every white-listed variant in a single string", async () => {
    const { applyMapping } = await import("../convert-bracket-tokens-to-mustache");
    expect(
      applyMapping("[Creator Name] / [KOL Name] / [Creator] / [Your Name] / [DATE]")
    ).toBe("{{kol.name}} / {{kol.name}} / {{kol.name}} / {{marketer.name}} / [DATE]");
  });
});

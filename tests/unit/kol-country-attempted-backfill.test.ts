/**
 * BL-081-F005 · Unit tests for the country-attempted backfill core.
 *
 * Drives `runCountryAttemptedBackfill` against a fake Prisma surface so
 * the dry-run / apply / idempotency / tenant-scoping behaviour is pinned
 * without a Postgres testcontainer (the live UPDATE is exercised by the
 * staging/prod run in F005's acceptance).
 */
import { describe, expect, it, vi } from "vitest";

import {
  parseArgs,
  runCountryAttemptedBackfill,
  type BackfillPrisma,
} from "../../scripts/kol-country-attempted-backfill";

function makeFakePrisma(eligible: number, updated: number) {
  const queryCalls: Array<{ sql: string; values: unknown[] }> = [];
  const executeCalls: Array<{ sql: string; values: unknown[] }> = [];
  const prisma: BackfillPrisma = {
    $queryRawUnsafe: vi.fn(async (sql: string, ...values: unknown[]) => {
      queryCalls.push({ sql, values });
      return [{ eligible }] as never;
    }),
    $executeRawUnsafe: vi.fn(async (sql: string, ...values: unknown[]) => {
      executeCalls.push({ sql, values });
      return updated;
    }),
  };
  return { prisma, queryCalls, executeCalls };
}

describe("parseArgs", () => {
  it("defaults to apply-mode, all tenants", () => {
    expect(parseArgs([])).toEqual({ dryRun: false, tenantId: null });
  });

  it("parses --dry-run and --tenant=<uuid>", () => {
    expect(parseArgs(["--dry-run", "--tenant=abc-123"])).toEqual({
      dryRun: true,
      tenantId: "abc-123",
    });
  });

  it("parses the space-separated --tenant form", () => {
    expect(parseArgs(["--tenant", "t-9"])).toEqual({
      dryRun: false,
      tenantId: "t-9",
    });
  });
});

describe("runCountryAttemptedBackfill", () => {
  it("dry-run counts eligible rows and writes nothing", async () => {
    const { prisma, executeCalls } = makeFakePrisma(2081, 2081);
    const result = await runCountryAttemptedBackfill(prisma, {
      dryRun: true,
      tenantId: null,
    });
    expect(result).toEqual({ eligible: 2081, updated: 0, dryRun: true });
    // The whole point of --dry-run: no UPDATE.
    expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
    expect(executeCalls).toEqual([]);
  });

  it("apply stamps every eligible row and reports the count", async () => {
    const { prisma } = makeFakePrisma(2081, 2081);
    const result = await runCountryAttemptedBackfill(prisma, {
      dryRun: false,
      tenantId: null,
    });
    expect(result).toEqual({ eligible: 2081, updated: 2081, dryRun: false });
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(1);
  });

  it("is idempotent: a second apply stamps 0 rows (predicate excludes already-marked)", async () => {
    // Fresh run already stamped them, so now nothing matches the
    // `country_enrichment_attempted_at IS NULL` predicate.
    const { prisma } = makeFakePrisma(0, 0);
    const result = await runCountryAttemptedBackfill(prisma, {
      dryRun: false,
      tenantId: null,
    });
    expect(result).toEqual({ eligible: 0, updated: 0, dryRun: false });
  });

  it("UPDATE only stamps NULL attempted_at + NULL country (never overwrites)", async () => {
    const { prisma, executeCalls } = makeFakePrisma(5, 5);
    await runCountryAttemptedBackfill(prisma, { dryRun: false, tenantId: null });
    const sql = executeCalls[0]!.sql;
    expect(sql).toContain("country_enrichment_attempted_at = NOW()");
    expect(sql).toContain("country_enrichment_attempted_at IS NULL");
    expect(sql).toMatch(/country_code IS NULL OR length\(btrim\(country_code\)\) = 0/);
    expect(sql).toContain("deleted_at IS NULL");
  });

  it("scopes to a single tenant when --tenant is given", async () => {
    const { prisma, queryCalls, executeCalls } = makeFakePrisma(10, 10);
    await runCountryAttemptedBackfill(prisma, {
      dryRun: false,
      tenantId: "11111111-2222-3333-4444-555555555555",
    });
    expect(queryCalls[0]!.sql).toContain("tenant_id = $1::uuid");
    expect(queryCalls[0]!.values).toEqual([
      "11111111-2222-3333-4444-555555555555",
    ]);
    expect(executeCalls[0]!.values).toEqual([
      "11111111-2222-3333-4444-555555555555",
    ]);
  });
});

/**
 * BL-083-F006 · Unit tests for the kol.emails backfill core.
 *
 * Drives `runEmailsBackfill` against a fake Prisma so dry-run / apply /
 * idempotency behaviour is pinned without a testcontainer (the live
 * UPDATE runs in F006 staging + prod verification).
 */
import { describe, expect, it, vi } from "vitest";

import {
  EMAILS_BACKFILL_WHERE,
  parseArgs,
  runEmailsBackfill,
} from "../../scripts/kol-emails-backfill";

const TENANT = "11111111-2222-3333-4444-555555555555";

/** Fake prisma: COUNT returns a configurable eligible total; UPDATE
 *  returns a configurable affected-row count. */
function fakePrisma(eligible: number, affected: number = eligible) {
  const queryCalls: Array<{ sql: string; values: unknown[] }> = [];
  const execCalls: Array<{ sql: string; values: unknown[] }> = [];
  const prisma = {
    $queryRawUnsafe: vi.fn(async (sql: string, ...values: unknown[]) => {
      queryCalls.push({ sql, values });
      return [{ count: eligible }];
    }),
    $executeRawUnsafe: vi.fn(async (sql: string, ...values: unknown[]) => {
      execCalls.push({ sql, values });
      return affected;
    }),
  };
  return { prisma, queryCalls, execCalls };
}

describe("parseArgs", () => {
  it("defaults to apply-mode, demo tenant", () => {
    expect(parseArgs([])).toEqual({ dryRun: false, tenantId: null });
  });
  it("parses --dry-run + --tenant=", () => {
    expect(parseArgs(["--dry-run", "--tenant=t1"])).toEqual({
      dryRun: true,
      tenantId: "t1",
    });
  });
});

describe("EMAILS_BACKFILL_WHERE predicate", () => {
  it("scopes to youtube + non-empty metadata.raw.emails + NULL emails (idempotent)", () => {
    expect(EMAILS_BACKFILL_WHERE).toContain("platform = 'youtube'");
    expect(EMAILS_BACKFILL_WHERE).toContain("metadata -> 'raw' -> 'emails'");
    expect(EMAILS_BACKFILL_WHERE).toContain("jsonb_array_length");
    // never clobber an already-filled row → idempotency guard
    expect(EMAILS_BACKFILL_WHERE).toContain("emails IS NULL");
  });
});

describe("runEmailsBackfill", () => {
  it("dry-run reports eligible count and writes nothing", async () => {
    const { prisma } = fakePrisma(219);
    const res = await runEmailsBackfill({
      prisma,
      tenantId: TENANT,
      dryRun: true,
    });
    expect(res.eligible).toBe(219);
    expect(res.updated).toBe(0);
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledTimes(1);
    expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
  });

  it("apply updates the eligible rows + stamps business-unlock", async () => {
    const { prisma, execCalls } = fakePrisma(219);
    const res = await runEmailsBackfill({
      prisma,
      tenantId: TENANT,
      dryRun: false,
    });
    expect(res.eligible).toBe(219);
    expect(res.updated).toBe(219);
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(1);
    // the UPDATE copies metadata.raw.emails and stamps the source
    expect(execCalls[0]!.sql).toContain(
      "emails = metadata -> 'raw' -> 'emails'",
    );
    expect(execCalls[0]!.sql).toContain("email_source = 'business-unlock'");
    expect(execCalls[0]!.values[0]).toBe(TENANT);
  });

  it("idempotent: a re-run with 0 eligible rows issues no UPDATE", async () => {
    const { prisma } = fakePrisma(0);
    const res = await runEmailsBackfill({
      prisma,
      tenantId: TENANT,
      dryRun: false,
    });
    expect(res.eligible).toBe(0);
    expect(res.updated).toBe(0);
    expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
  });
});

/**
 * BL-035-F007 (AI-H3) — redactOldEmailLogs unit specs.
 *
 * Verifies the dry-run / --apply split and that the retention cut-off
 * uses `< now - retentionDays * 24h`. Prisma is stubbed at the
 * function boundary — this is a one-purpose script and its only
 * external side effects are `findMany` + `updateMany`.
 */
import { describe, expect, it, vi } from "vitest";

import { redactOldEmailLogs } from "../redact-old-email-logs";

const REDACTION_MARKER = "[REDACTED 30d retention]";

function makePrismaStub(rows: Array<{ id: string }>, updateCount: number) {
  const findMany = vi.fn().mockResolvedValue(rows);
  const updateMany = vi.fn().mockResolvedValue({ count: updateCount });
  return {
    prisma: {
      emailLog: { findMany, updateMany },
    } as unknown as Parameters<typeof redactOldEmailLogs>[0]["prisma"],
    findMany,
    updateMany,
  };
}

describe("redactOldEmailLogs (BL-035-F007)", () => {
  it("dry-run reports candidates without writing", async () => {
    const { prisma, findMany, updateMany } = makePrismaStub(
      [{ id: "row-1" }, { id: "row-2" }, { id: "row-3" }],
      0,
    );

    const stats = await redactOldEmailLogs({
      apply: false,
      retentionDays: 30,
      prisma,
      log: () => {},
    });

    expect(stats).toEqual({ candidates: 3, redacted: 0, alreadyRedacted: 0 });
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("--apply writes the redaction marker for rows older than the cutoff", async () => {
    const { prisma, findMany, updateMany } = makePrismaStub(
      [{ id: "row-1" }, { id: "row-2" }],
      2,
    );

    const stats = await redactOldEmailLogs({
      apply: true,
      retentionDays: 30,
      prisma,
      log: () => {},
    });

    expect(stats).toEqual({ candidates: 2, redacted: 2, alreadyRedacted: 0 });
    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(updateMany.mock.calls[0][0]).toMatchObject({
      where: {
        id: { in: ["row-1", "row-2"] },
        bodyHtml: { not: REDACTION_MARKER },
      },
      data: { bodyHtml: REDACTION_MARKER },
    });

    const where = (findMany.mock.calls[0][0] as { where: { createdAt: { lt: Date } } })
      .where;
    const cutoff = where.createdAt.lt;
    const expectedCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    expect(cutoff.getTime()).toBeGreaterThan(expectedCutoff - 1_000);
    expect(cutoff.getTime()).toBeLessThan(expectedCutoff + 1_000);
  });

  it("no-ops when there are no candidates (no updateMany call)", async () => {
    const { prisma, updateMany } = makePrismaStub([], 0);

    const stats = await redactOldEmailLogs({
      apply: true,
      retentionDays: 30,
      prisma,
      log: () => {},
    });

    expect(stats).toEqual({ candidates: 0, redacted: 0, alreadyRedacted: 0 });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("respects a custom retentionDays (e.g. 14)", async () => {
    const { prisma, findMany } = makePrismaStub([], 0);

    await redactOldEmailLogs({
      apply: false,
      retentionDays: 14,
      prisma,
      log: () => {},
    });

    const where = (findMany.mock.calls[0][0] as { where: { createdAt: { lt: Date } } })
      .where;
    const cutoff = where.createdAt.lt;
    const expected = Date.now() - 14 * 24 * 60 * 60 * 1000;
    expect(Math.abs(cutoff.getTime() - expected)).toBeLessThan(1_000);
  });
});

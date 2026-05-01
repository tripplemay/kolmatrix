/**
 * MVP-internal-demo-prep F006 · Dashboard real-data integration spec
 *
 * Verifies fetchEmailPerformance() and fetchRecentActivity() against
 * a live test DB.  Uses the same withTestTenant pattern as dashboard-kpi.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { fetchEmailPerformance } from "@/lib/dashboard/email-performance";
import {
  fetchRecentActivity,
  formatRelativeTime,
  resolveActivityMeta,
} from "@/lib/dashboard/recent-activity";

import { cleanDb, setupTestDb, teardownTestDb, withTestTenant } from "../helpers/db";

beforeAll(async () => {
  await setupTestDb();
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await cleanDb();
});

// ---------------------------------------------------------------------------
// fetchEmailPerformance
// ---------------------------------------------------------------------------

describe("fetchEmailPerformance()", () => {
  it("returns 14 buckets regardless of data", async () => {
    await withTestTenant(async (_tenantId, tx) => {
      const result = await fetchEmailPerformance(tx);
      expect(result).toHaveLength(14);
    });
  });

  it("all buckets are zero when there are no EmailLog rows", async () => {
    await withTestTenant(async (_tenantId, tx) => {
      const result = await fetchEmailPerformance(tx);
      for (const p of result) {
        expect(p.sent).toBe(0);
        expect(p.opened).toBe(0);
        expect(p.replied).toBe(0);
      }
    });
  });

  it("counts sent/opened/replied into today's bucket", async () => {
    await withTestTenant(async (tenantId, tx) => {
      const now = new Date();
      // 3 sent-only, 2 opened, 1 replied
      const base = {
        tenantId,
        toAddress: "kol@test.com",
        fromAddress: "out@test.com",
        subject: "Test",
        bodyHtml: "<p>test</p>",
        provider: "resend",
        sentAt: now,
        deliveredAt: now,
      };
      await tx.emailLog.createMany({
        data: [
          { ...base, status: "sent" },
          { ...base, status: "sent" },
          { ...base, status: "sent" },
          { ...base, status: "opened", openedAt: now },
          { ...base, status: "opened", openedAt: now },
          { ...base, status: "replied", openedAt: now, repliedAt: now },
        ],
      });

      const result = await fetchEmailPerformance(tx);
      const today = result[result.length - 1];
      // All 6 are non-bounced → sent=6; 3 have openedAt → opened=3; 1 has repliedAt → replied=1
      expect(today.sent).toBe(6);
      expect(today.opened).toBe(3);
      expect(today.replied).toBe(1);
    });
  });

  it("excludes bounced emails from sent count", async () => {
    await withTestTenant(async (tenantId, tx) => {
      const now = new Date();
      await tx.emailLog.createMany({
        data: [
          {
            tenantId,
            toAddress: "a@test.com",
            fromAddress: "out@test.com",
            subject: "T",
            bodyHtml: "<p></p>",
            provider: "resend",
            status: "bounced",
            sentAt: now,
            bounceReason: "mailbox_full",
          },
          {
            tenantId,
            toAddress: "b@test.com",
            fromAddress: "out@test.com",
            subject: "T",
            bodyHtml: "<p></p>",
            provider: "resend",
            status: "sent",
            sentAt: now,
          },
        ],
      });
      const result = await fetchEmailPerformance(tx);
      const today = result[result.length - 1];
      expect(today.sent).toBe(1);
    });
  });

  it("ignores rows older than 14 days", async () => {
    await withTestTenant(async (tenantId, tx) => {
      const old = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
      await tx.emailLog.create({
        data: {
          tenantId,
          toAddress: "old@test.com",
          fromAddress: "out@test.com",
          subject: "Old",
          bodyHtml: "<p></p>",
          provider: "resend",
          status: "sent",
          sentAt: old,
        },
      });
      const result = await fetchEmailPerformance(tx);
      const total = result.reduce((s, p) => s + p.sent, 0);
      expect(total).toBe(0);
    });
  });
});

// ---------------------------------------------------------------------------
// fetchRecentActivity
// ---------------------------------------------------------------------------

describe("fetchRecentActivity()", () => {
  it("returns empty array when there are no audit rows", async () => {
    await withTestTenant(async (_tenantId, tx) => {
      const rows = await fetchRecentActivity(tx);
      expect(rows).toHaveLength(0);
    });
  });

  it("returns at most 5 rows ordered newest-first", async () => {
    await withTestTenant(async (tenantId, tx) => {
      const base = new Date("2026-04-01T00:00:00Z");
      for (let i = 0; i < 7; i++) {
        await tx.auditLog.create({
          data: {
            tenantId,
            action: "campaign.kol.added",
            resourceType: "campaign",
            createdAt: new Date(base.getTime() + i * 60_000),
          },
        });
      }
      const rows = await fetchRecentActivity(tx);
      expect(rows).toHaveLength(5);
      // newest first
      for (let i = 0; i < rows.length - 1; i++) {
        expect(rows[i].createdAt.getTime()).toBeGreaterThan(rows[i + 1].createdAt.getTime());
      }
    });
  });
});

// ---------------------------------------------------------------------------
// resolveActivityMeta + formatRelativeTime (pure unit assertions)
// ---------------------------------------------------------------------------

describe("resolveActivityMeta()", () => {
  it("returns correct meta for a known action", () => {
    const meta = resolveActivityMeta("campaign.kol.added");
    expect(meta.icon).toBe("group_add");
    expect(meta.accent).toBe("cyan");
    expect(meta.i18nKey).toBe("campaignKolAdded");
  });

  it("returns fallback meta for an unknown action", () => {
    const meta = resolveActivityMeta("some.unknown.action");
    expect(meta.icon).toBe("info");
    expect(meta.accent).toBe("secondary");
    expect(meta.i18nKey).toBe("unknown");
  });
});

describe("formatRelativeTime()", () => {
  it("returns 'just now' for sub-minute deltas", () => {
    expect(formatRelativeTime(new Date(Date.now() - 30_000))).toBe("just now");
  });

  it("formats minutes correctly", () => {
    expect(formatRelativeTime(new Date(Date.now() - 10 * 60_000))).toBe("10m ago");
  });

  it("formats hours correctly", () => {
    expect(formatRelativeTime(new Date(Date.now() - 3 * 3600_000))).toBe("3h ago");
  });

  it("formats days correctly", () => {
    expect(formatRelativeTime(new Date(Date.now() - 2 * 24 * 3600_000))).toBe("2d ago");
  });
});

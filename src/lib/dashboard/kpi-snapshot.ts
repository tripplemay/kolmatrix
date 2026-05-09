/**
 * Daily KPI snapshot writer (BL-052 F002 / Part A · BL-050).
 *
 * One row per (tenantId, snapshot_date) holds the 5 KPI scalars at cron
 * time. Rerunning on the same day is idempotent (upsert by composite
 * primary key). The cron entry scripts/kpi-snapshot-daily.ts (F003)
 * iterates every tenant under withTenant().
 *
 * Tenancy: takeKpiSnapshot is meant to run inside withTenant() (so RLS
 * sees the row), but the upsert also passes tenantId explicitly so
 * stray cross-tenant calls cannot succeed (composite PK collision +
 * RLS reject = double belt).
 */
import type { PrismaClient } from "@prisma/client";

import { assertUuid } from "@/lib/uuid";

export interface KpiSnapshotRecord {
  tenantId: string;
  snapshotDate: Date;
  kolCount: number;
  activeCampaigns: number;
  emailsSent7d: number;
  productCount: number;
  avgValueScore: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Compute and persist the 5 KPI scalars for a single tenant.
 * `asOf` defaults to "now"; tests pass a fixed clock.
 */
export async function takeKpiSnapshot(
  prisma: PrismaClient,
  tenantId: string,
  asOf: Date = new Date()
): Promise<KpiSnapshotRecord> {
  assertUuid(tenantId, "tenantId");
  const snapshotDate = startOfUtcDay(asOf);
  const sevenDaysAgo = new Date(asOf.getTime() - 7 * MS_PER_DAY);

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;

    const [kolCount, activeCampaigns, emailsSent7d, productCount, valueScoreAgg] =
      await Promise.all([
        tx.kol.count({ where: { isGaming: true, deletedAt: null } }),
        tx.campaign.count({ where: { status: "active" } }),
        tx.emailLog.count({ where: { sentAt: { gte: sevenDaysAgo } } }),
        tx.product.count(),
        tx.kol.aggregate({
          _avg: { valueScore: true },
          where: { isGaming: true, valueScore: { not: null }, deletedAt: null },
        }),
      ]);

    const avgRaw = valueScoreAgg._avg.valueScore;
    const avgValueScore = avgRaw == null ? 0 : Math.round(Number(avgRaw.toString()));

    const row = await tx.kpiDailySnapshot.upsert({
      where: { tenantId_snapshotDate: { tenantId, snapshotDate } },
      create: {
        tenantId,
        snapshotDate,
        kolCount,
        activeCampaigns,
        emailsSent7d,
        productCount,
        avgValueScore,
      },
      update: {
        kolCount,
        activeCampaigns,
        emailsSent7d,
        productCount,
        avgValueScore,
      },
    });

    return {
      tenantId: row.tenantId,
      snapshotDate: row.snapshotDate,
      kolCount: row.kolCount,
      activeCampaigns: row.activeCampaigns,
      emailsSent7d: row.emailsSent7d,
      productCount: row.productCount,
      avgValueScore: Number(row.avgValueScore.toString()),
    };
  });
}

export interface TakeAllTenantsResult {
  totalTenants: number;
  succeeded: number;
  failed: { tenantId: string; error: string }[];
}

/**
 * Iterate every tenant and snapshot. Failures are isolated — one
 * tenant's error does not stop the others. Caller (cron entry) signals
 * non-zero exit when failed.length > 0.
 */
export async function takeAllTenantsKpiSnapshot(
  prisma: PrismaClient,
  asOf: Date = new Date()
): Promise<TakeAllTenantsResult> {
  const tenants = await prisma.tenant.findMany({
    select: { id: true },
    orderBy: { id: "asc" },
  });

  const failed: { tenantId: string; error: string }[] = [];
  let succeeded = 0;

  for (const { id } of tenants) {
    try {
      await takeKpiSnapshot(prisma, id, asOf);
      succeeded += 1;
    } catch (err) {
      failed.push({
        tenantId: id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { totalTenants: tenants.length, succeeded, failed };
}

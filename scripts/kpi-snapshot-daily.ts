/**
 * BL-052 F003 · Daily KPI snapshot cron entry.
 *
 * Iterates every tenant and writes one row into `kpi_daily_snapshot`
 * per (tenantId, today). Idempotent: same-day reruns upsert on the
 * composite primary key. Designed to be chained AFTER kol-sync:daily
 * inside the same /etc/cron.d entry so the KOL counts captured here
 * already reflect today's freshly-synced rows. The chained command
 * lives in framework/harness/deploy-patterns.md / docs/dev — see the
 * runbook for the exact cron line + rollout steps.
 *
 * Failure policy: per-tenant errors are isolated by
 * takeAllTenantsKpiSnapshot. The script exits with code 1 only when
 * at least one tenant failed, so cron alerting can pick it up; a
 * total-success run exits 0 quietly.
 *
 * Env:
 *   DATABASE_URL         non-superuser app role (RLS pins each tenant)
 *   DATABASE_ADMIN_URL   superuser fallback used by other cron entries
 *
 * Output:
 *   stdout   one JSON line per run for log shipping
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { takeAllTenantsKpiSnapshot } from "../src/lib/dashboard/kpi-snapshot";

interface RunSummary {
  ts: string;
  totalTenants: number;
  succeeded: number;
  failedCount: number;
  failed: { tenantId: string; error: string }[];
}

export async function runKpiSnapshotDaily(prisma: PrismaClient): Promise<RunSummary> {
  const result = await takeAllTenantsKpiSnapshot(prisma);
  return {
    ts: new Date().toISOString(),
    totalTenants: result.totalTenants,
    succeeded: result.succeeded,
    failedCount: result.failed.length,
    failed: result.failed,
  };
}

async function main(): Promise<void> {
  const conn = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
  if (!conn) {
    console.error("[kpi-snapshot-daily] DATABASE_URL not set — refusing to run");
    process.exit(1);
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: conn }) });

  let summary: RunSummary;
  try {
    summary = await runKpiSnapshotDaily(prisma);
  } finally {
    await prisma.$disconnect();
  }

  console.log(JSON.stringify(summary));
  process.exit(summary.failedCount > 0 ? 1 : 0);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(
      `[kpi-snapshot-daily] fatal: ${err instanceof Error ? err.stack ?? err.message : err}`
    );
    process.exit(1);
  });
}

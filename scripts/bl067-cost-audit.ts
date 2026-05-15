/**
 * BL-067-F007 · Audit-log cost rollup for the C3 explainability batch.
 *
 * Reads the last 24h of `audit_log` rows whose `action` matches
 * `ai_recommendation.explain_*` and emits a CSV-style summary so ops
 * can compare against the BL-034 F005 $5/day/tenant cap and the dogfood
 * cost projection in spec §6 风险表.
 *
 * The script counts ALL tenants (admin role, no withTenant pin) because
 * the dogfood + signoff perspective is "platform-wide BL-067 spend per
 * day". Per-tenant breakdowns are emitted in the same pass.
 *
 * Run path:
 *   npx tsx scripts/bl067-cost-audit.ts [--hours=24] [--env=prod|staging]
 *
 * Output (stdout):
 *   total_calls, total_tokens, total_cost_usd
 *   per-action breakdown
 *   per-tenant top-5 spenders (anonymised — last 6 of tenantId)
 *
 * No DELETE / UPDATE — read-only.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

interface CliArgs {
  hours: number;
}

export function parseArgs(argv: readonly string[]): CliArgs {
  const args: CliArgs = { hours: 24 };
  for (const a of argv) {
    const m = a.match(/^--hours=(\d+)$/);
    if (m) {
      const h = Number(m[1]);
      if (Number.isFinite(h) && h > 0 && h <= 24 * 30) {
        args.hours = h;
      }
    }
  }
  return args;
}

interface AuditPayload {
  before?: Record<string, unknown>;
  after?: {
    tokenUsage?: number;
    costUsd?: number;
    locale?: string;
    kolId?: string;
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("[cost-audit] DATABASE_URL missing — set in .env");
    process.exit(1);
  }
  const adapter = new PrismaPg({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter });

  try {
    const since = new Date(Date.now() - args.hours * 60 * 60 * 1000);

    const rows = await prisma.auditLog.findMany({
      where: {
        action: { startsWith: "ai_recommendation.explain_" },
        createdAt: { gt: since },
      },
      select: {
        action: true,
        tenantId: true,
        payload: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    let totalCalls = 0;
    let totalTokens = 0;
    let totalCostUsd = 0;
    const perAction = new Map<string, { calls: number; tokens: number; cost: number }>();
    const perTenant = new Map<string, { calls: number; tokens: number; cost: number }>();

    for (const r of rows) {
      totalCalls += 1;
      const payload = (r.payload ?? {}) as AuditPayload;
      const tokens = payload.after?.tokenUsage ?? 0;
      const cost = payload.after?.costUsd ?? 0;
      totalTokens += typeof tokens === "number" ? tokens : 0;
      totalCostUsd += typeof cost === "number" ? cost : 0;

      const actionKey = r.action;
      const a = perAction.get(actionKey) ?? { calls: 0, tokens: 0, cost: 0 };
      a.calls += 1;
      a.tokens += typeof tokens === "number" ? tokens : 0;
      a.cost += typeof cost === "number" ? cost : 0;
      perAction.set(actionKey, a);

      const tKey = r.tenantId ?? "__platform__";
      const t = perTenant.get(tKey) ?? { calls: 0, tokens: 0, cost: 0 };
      t.calls += 1;
      t.tokens += typeof tokens === "number" ? tokens : 0;
      t.cost += typeof cost === "number" ? cost : 0;
      perTenant.set(tKey, t);
    }

    console.log("BL-067 cost audit — last %d hours (since %s)", args.hours, since.toISOString());
    console.log("");
    console.log("TOTAL");
    console.log("  calls:        %d", totalCalls);
    console.log("  tokens:       %d", totalTokens);
    console.log("  cost_usd:     %s", totalCostUsd.toFixed(4));
    console.log("");
    console.log("BY ACTION");
    for (const [action, stats] of perAction) {
      console.log(
        "  %s — calls=%d tokens=%d cost_usd=%s",
        action,
        stats.calls,
        stats.tokens,
        stats.cost.toFixed(4),
      );
    }
    console.log("");
    console.log("BY TENANT (top 5 by cost)");
    const tenantsSorted = Array.from(perTenant.entries())
      .sort((a, b) => b[1].cost - a[1].cost)
      .slice(0, 5);
    for (const [tenantId, stats] of tenantsSorted) {
      const anonymised = tenantId === "__platform__"
        ? "platform"
        : `…${tenantId.slice(-6)}`;
      console.log(
        "  %s — calls=%d tokens=%d cost_usd=%s",
        anonymised,
        stats.calls,
        stats.tokens,
        stats.cost.toFixed(4),
      );
    }
    console.log("");
    console.log(
      "Cap reference: BL-034 F005 $5/day/tenant. Any per-tenant cost > $5 indicates a race or cap miscount."
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[cost-audit] failed:", err);
  process.exit(1);
});

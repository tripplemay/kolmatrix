/**
 * BL-068-F007 · Audit-log cost + parse-success rollup for conversational
 * refine.
 *
 * Reads the last 24h of `audit_log` rows whose `action` matches
 * `ai_recommendation.refine_*` and emits a stdout report covering:
 *
 *   - Total calls / tokens / cost across the platform
 *   - Per-action breakdown (refine_applied / refine_unparsable /
 *     refine_parse_failed / refine_permutation_invalid /
 *     refine_cap_exhausted)
 *   - Per-tenant top-5 spenders (anonymised tenant suffix)
 *   - **Parse success rate** — refine_applied / total — gated ≥ 80%
 *     per docs/product/ai-native-roadmap.md §11 Phase 3 (this is the
 *     headline acceptance metric for BL-068 signoff)
 *
 * Cost data lives in `audit_log.payload.after.cost_usd` and
 * `audit_log.payload.after.token_usage` (per refine-actions.ts F002
 * success branch). The unparsable / permutation / parse_failed /
 * cap_exhausted branches do not record cost — those are zero-cost
 * fallbacks at the LLM layer (cap_exhausted is the only one that may
 * have leaked LLM cost in the race-condition variant; we still count
 * the call but treat cost as 0 when the field is absent).
 *
 * Run path:
 *   npx tsx scripts/bl068-cost-audit.ts [--hours=24]
 *
 * Companion to bl067-cost-audit.ts (BL-067 explainability rollup) —
 * identical reporting shape so the team can diff the two batches in
 * the same dashboard.
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
    token_usage?: number;
    cost_usd?: number;
    locale?: string;
    raw_query?: string;
    result_kol_ids?: string[];
  };
}

const PARSE_SUCCESS_GATE = 0.8;

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  // BL-068 fix-round 1 (B3): platform-wide audit query needs admin
  // connection. DATABASE_URL uses the kolmatrix_app role which has RLS
  // enforcement scoped to the session tenant — running this script
  // without setting a tenant ctx returns 0 rows even when SQL direct
  // query shows entries (caught on staging 2026-05-17 spot-check, 2
  // `ai_recommendation.refine_unparsable` rows invisible to the script).
  // Prefer DATABASE_ADMIN_URL (superuser, RLS bypass for SELECT); fall
  // back to DATABASE_URL with a stderr warning so the operator knows
  // the result may be empty under RLS scope.
  const adminUrl = process.env.DATABASE_ADMIN_URL;
  const fallbackUrl = process.env.DATABASE_URL;
  const databaseUrl = adminUrl ?? fallbackUrl;
  if (!databaseUrl) {
    console.error(
      "[cost-audit] DATABASE_ADMIN_URL / DATABASE_URL missing — set in .env",
    );
    process.exit(1);
  }
  if (!adminUrl) {
    console.warn(
      "[cost-audit] WARNING: DATABASE_ADMIN_URL not set, falling back to " +
        "DATABASE_URL. If audit_log has RLS, this query may return 0 rows " +
        "even when entries exist. Set DATABASE_ADMIN_URL for accurate counts.",
    );
  }
  const adapter = new PrismaPg({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter });

  try {
    const since = new Date(Date.now() - args.hours * 60 * 60 * 1000);

    const rows = await prisma.auditLog.findMany({
      where: {
        action: { startsWith: "ai_recommendation.refine_" },
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
    const perAction = new Map<
      string,
      { calls: number; tokens: number; cost: number }
    >();
    const perTenant = new Map<
      string,
      { calls: number; tokens: number; cost: number }
    >();

    for (const r of rows) {
      totalCalls += 1;
      const payload = (r.payload ?? {}) as AuditPayload;
      const tokens = payload.after?.token_usage ?? 0;
      const cost = payload.after?.cost_usd ?? 0;
      totalTokens += typeof tokens === "number" ? tokens : 0;
      totalCostUsd += typeof cost === "number" ? cost : 0;

      const actionKey = r.action;
      const a =
        perAction.get(actionKey) ?? { calls: 0, tokens: 0, cost: 0 };
      a.calls += 1;
      a.tokens += typeof tokens === "number" ? tokens : 0;
      a.cost += typeof cost === "number" ? cost : 0;
      perAction.set(actionKey, a);

      const tKey = r.tenantId ?? "__platform__";
      const t =
        perTenant.get(tKey) ?? { calls: 0, tokens: 0, cost: 0 };
      t.calls += 1;
      t.tokens += typeof tokens === "number" ? tokens : 0;
      t.cost += typeof cost === "number" ? cost : 0;
      perTenant.set(tKey, t);
    }

    const appliedCalls =
      perAction.get("ai_recommendation.refine_applied")?.calls ?? 0;
    const parseSuccessRate = totalCalls === 0 ? 0 : appliedCalls / totalCalls;
    const gatePass = parseSuccessRate >= PARSE_SUCCESS_GATE;

    console.log(
      "BL-068 refine cost + parse-success audit — last %d hours (since %s)",
      args.hours,
      since.toISOString(),
    );
    console.log("");
    console.log("TOTAL");
    console.log("  calls:        %d", totalCalls);
    console.log("  tokens:       %d", totalTokens);
    console.log("  cost_usd:     %s", totalCostUsd.toFixed(4));
    console.log("");
    console.log("PARSE SUCCESS RATE (roadmap §11 Phase 3 gate ≥ 80%%)");
    console.log("  refine_applied / total: %d / %d", appliedCalls, totalCalls);
    console.log(
      "  rate:                   %s%% — %s",
      (parseSuccessRate * 100).toFixed(2),
      gatePass ? "PASS" : "FAIL",
    );
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
      const anonymised =
        tenantId === "__platform__"
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
      "Cap reference: BL-034 F005 $5/day/tenant. Any per-tenant cost > $5 indicates a race or cap miscount.",
    );

    // Exit non-zero when the parse-success gate fails so this script
    // can be used as a CI/dogfood checkpoint (rather than a silent
    // dashboard fetch).
    if (totalCalls > 0 && !gatePass) {
      process.exitCode = 2;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[cost-audit] failed:", err);
  process.exit(1);
});

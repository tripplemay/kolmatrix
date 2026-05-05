/**
 * BM2-F007 · `/crm` overview loader.
 *
 * Single tenant-scoped read aggregating the four panels:
 *   - stageDistribution (6-bucket KOL relationshipStatus breakdown)
 *   - funnelMetrics (4-step pipeline → long-term funnel + conversions)
 *   - collabKpi (totals + 14d "commitments" sparkline; avgRoi=null)
 *   - recentChanges (audit_log `kol.relationship_changed` last 30)
 *
 * audit_log is a platform table (no RLS) — every query manually
 * filters `tenant_id = $tenantId` per Planner §13.4 #1.
 */
import { withTenant } from "@/lib/db";

import {
  bucketCommitments14d,
  fillStageDistribution,
  stagesToFunnel,
  type FunnelStep,
  type StageBucket,
} from "./aggregate";

const ENGAGEMENT_STATUSES = ["signed", "delivered", "paid"] as const;

/**
 * BIx-mvp-polish-pass F001 — `/crm` time-toggle ranges.
 *
 * - `thisQuarter` → start of the current calendar quarter (UTC)
 * - `last90d`     → 90 days ago (default; matches the legacy single
 *                    enabled toggle)
 * - `allTime`     → undefined cutoff (no createdAt filter)
 */
export type CrmRange = "thisQuarter" | "last90d" | "allTime";

export const DEFAULT_CRM_RANGE: CrmRange = "last90d";

export function isCrmRange(value: unknown): value is CrmRange {
  return value === "thisQuarter" || value === "last90d" || value === "allTime";
}

/**
 * Resolve a range to an inclusive start Date (or null for `allTime`).
 * `now` is injectable so tests pin a deterministic boundary.
 */
export function rangeStart(range: CrmRange, now: Date = new Date()): Date | null {
  if (range === "allTime") return null;
  if (range === "last90d") {
    return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  }
  // thisQuarter — UTC quarter boundary so the cutoff is deterministic
  // regardless of where the request was rendered from.
  const month = now.getUTCMonth();
  const quarterStartMonth = month - (month % 3);
  return new Date(Date.UTC(now.getUTCFullYear(), quarterStartMonth, 1));
}

export interface CrmKpi {
  totalPipeline: number;
  longTermPartners: number;
  longTermRatio: number; // 0..1
  cumulativeSpend: number; // Σ KolCampaign.kolFee where status engaged
  spendSparkline: number[]; // 14 daily commitment counts (proxy)
  avgRoi: number | null; // F008 placeholder
}

export interface CrmRecentChange {
  actorId: string | null;
  actorName: string | null;
  kolId: string | null;
  kolName: string | null;
  kolAvatarUrl: string | null;
  before: string | null;
  after: string | null;
  changedAt: string; // ISO
}

export interface CrmOverview {
  stageDistribution: StageBucket[];
  funnelMetrics: { steps: FunnelStep[] };
  collabKpi: CrmKpi;
  recentChanges: CrmRecentChange[];
}

interface AuditPayload {
  before?: { relationshipStatus?: string };
  after?: { relationshipStatus?: string };
}

function readStatusFromPayload(payload: unknown, side: "before" | "after"): string | null {
  if (!payload || typeof payload !== "object") return null;
  const inner = (payload as AuditPayload)[side];
  if (!inner || typeof inner !== "object") return null;
  const v = inner.relationshipStatus;
  return typeof v === "string" ? v : null;
}

export interface RunCrmOverviewOptions {
  /** Default `last90d`; UI surfaces a 3-way toggle. */
  range?: CrmRange;
}

export async function runCrmOverview(
  tenantId: string,
  options: RunCrmOverviewOptions = {}
): Promise<CrmOverview> {
  const range = options.range ?? DEFAULT_CRM_RANGE;
  const cutoff = rangeStart(range);

  // Stage distribution + cumulative spend run inside withTenant (RLS
  // enforces tenant scoping on Kol + KolCampaign). The time-range
  // toggle filters by createdAt — `null` cutoff (allTime) means no
  // filter, matching the legacy default scope.
  const tenantBlock = await withTenant(tenantId, async (tx) => {
    const grouped = await tx.kol.groupBy({
      by: ["relationshipStatus"],
      _count: { _all: true },
      where: {
        deletedAt: null,
        ...(cutoff ? { createdAt: { gte: cutoff } } : {}),
      },
    });
    const stageDistribution = fillStageDistribution(
      grouped.map((g) => ({
        status: g.relationshipStatus,
        count: g._count._all,
      }))
    );

    const spendRows = await tx.kolCampaign.findMany({
      where: {
        status: { in: [...ENGAGEMENT_STATUSES] },
        ...(cutoff ? { createdAt: { gte: cutoff } } : {}),
      },
      select: { kolFee: true },
    });
    const cumulativeSpend = spendRows.reduce((acc, r) => {
      if (r.kolFee == null) return acc;
      return acc + Number(r.kolFee.toString());
    }, 0);

    return { stageDistribution, cumulativeSpend };
  });

  // BL-034 F003: audit_log gained an RLS policy
  // (20260505010000_audit_event_log_rls). Reads via the bare prisma
  // client return zero rows because `current_setting('app.tenant_id')`
  // is unset → the policy filters every row out. Wrap both findMany
  // calls in withTenant() so the policy short-circuits to the tenant
  // branch. The explicit `tenantId` predicate is kept as
  // defense-in-depth (matches §F003 ai-suggestions-actions.ts pattern).
  // The 14d sparkline window is independent of the toggle — it always
  // shows the last 14 days of commitments because the KPI tile labels
  // itself "14d activity".
  const since14d = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const [commitmentEvents, recentRaw] = await withTenant(tenantId, async (tx) =>
    Promise.all([
      tx.auditLog.findMany({
        where: {
          tenantId,
          action: "kol.relationship_changed",
          createdAt: { gte: since14d },
        },
        select: { createdAt: true, payload: true },
      }),
      tx.auditLog.findMany({
        where: {
          tenantId,
          action: "kol.relationship_changed",
          ...(cutoff ? { createdAt: { gte: cutoff } } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          actorUserId: true,
          resourceId: true,
          payload: true,
          createdAt: true,
        },
      }),
    ]),
  );

  const commitmentEventsTyped = commitmentEvents.map((e) => ({
    createdAt: e.createdAt,
    afterStatus: readStatusFromPayload(e.payload, "after"),
  }));

  // Resolve actor + kol display info inside withTenant so RLS hides
  // any cross-tenant rows the platform-scope auditLog might have
  // somehow ended up referencing (defence in depth).
  const actorIds = Array.from(
    new Set(
      recentRaw.map((r) => r.actorUserId).filter((id): id is string => typeof id === "string")
    )
  );
  const kolIds = Array.from(
    new Set(recentRaw.map((r) => r.resourceId).filter((id): id is string => typeof id === "string"))
  );

  const lookups = await withTenant(tenantId, async (tx) => {
    const [users, kols] = await Promise.all([
      actorIds.length > 0
        ? tx.user.findMany({
            where: { id: { in: actorIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      kolIds.length > 0
        ? tx.kol.findMany({
            where: { id: { in: kolIds } },
            select: { id: true, displayName: true, avatarUrl: true },
          })
        : Promise.resolve([]),
    ]);
    return {
      userById: new Map(users.map((u) => [u.id, u.name])),
      kolById: new Map(kols.map((k) => [k.id, { name: k.displayName, avatarUrl: k.avatarUrl }])),
    };
  });

  const recentChanges: CrmRecentChange[] = recentRaw.map((r) => {
    const kolInfo = r.resourceId ? lookups.kolById.get(r.resourceId) : null;
    return {
      actorId: r.actorUserId ?? null,
      actorName: r.actorUserId ? (lookups.userById.get(r.actorUserId) ?? null) : null,
      kolId: r.resourceId ?? null,
      kolName: kolInfo?.name ?? null,
      kolAvatarUrl: kolInfo?.avatarUrl ?? null,
      before: readStatusFromPayload(r.payload, "before"),
      after: readStatusFromPayload(r.payload, "after"),
      changedAt: r.createdAt.toISOString(),
    };
  });

  const longTermPartners =
    tenantBlock.stageDistribution.find((b) => b.status === "long_term")?.count ?? 0;
  const totalPipeline = tenantBlock.stageDistribution.reduce((acc, b) => acc + b.count, 0);
  const longTermRatio =
    totalPipeline > 0 ? Math.round((longTermPartners / totalPipeline) * 1000) / 1000 : 0;

  return {
    stageDistribution: tenantBlock.stageDistribution,
    funnelMetrics: {
      steps: stagesToFunnel(tenantBlock.stageDistribution),
    },
    collabKpi: {
      totalPipeline,
      longTermPartners,
      longTermRatio,
      cumulativeSpend: Math.round(tenantBlock.cumulativeSpend * 100) / 100,
      spendSparkline: bucketCommitments14d(commitmentEventsTyped),
      avgRoi: null,
    },
    recentChanges,
  };
}

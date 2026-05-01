import type { TenantPrisma } from "@/lib/db";

export interface ActivityItem {
  id: string;
  icon: string;
  accent: "cyan" | "purple" | "secondary";
  text: string;
  time: string;
}

export interface RawAuditRow {
  id: bigint;
  action: string;
  createdAt: Date;
}

type ActionMeta = { icon: string; accent: ActivityItem["accent"]; i18nKey: string };

const ACTION_META: Record<string, ActionMeta> = {
  "campaign.kol.added": { icon: "group_add", accent: "cyan", i18nKey: "campaignKolAdded" },
  "campaign.kol.removed": {
    icon: "group_remove",
    accent: "secondary",
    i18nKey: "campaignKolRemoved",
  },
  "campaign.kol.status_changed": {
    icon: "check_circle",
    accent: "purple",
    i18nKey: "campaignKolStatusChanged",
  },
  "campaign.kol.fee_updated": {
    icon: "payments",
    accent: "secondary",
    i18nKey: "campaignKolFeeUpdated",
  },
  "campaign.status_transitioned": {
    icon: "campaign",
    accent: "purple",
    i18nKey: "campaignStatusTransitioned",
  },
  "campaign.fields_updated": {
    icon: "edit",
    accent: "secondary",
    i18nKey: "campaignFieldsUpdated",
  },
  "campaign.revenue_recorded": {
    icon: "trending_up",
    accent: "cyan",
    i18nKey: "campaignRevenueRecorded",
  },
  "kol.relationship_changed": {
    icon: "handshake",
    accent: "cyan",
    i18nKey: "kolRelationshipChanged",
  },
  "kol.bulk_added_to_campaign": { icon: "group_add", accent: "cyan", i18nKey: "kolBulkAdded" },
};

const FALLBACK_META: ActionMeta = {
  icon: "info",
  accent: "secondary",
  i18nKey: "unknown",
};

export function resolveActivityMeta(action: string): ActionMeta {
  return ACTION_META[action] ?? FALLBACK_META;
}

export function formatRelativeTime(d: Date): string {
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export async function fetchRecentActivity(tx: TenantPrisma): Promise<RawAuditRow[]> {
  return tx.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, action: true, createdAt: true },
  });
}

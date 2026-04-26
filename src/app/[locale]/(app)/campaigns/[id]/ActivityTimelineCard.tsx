/**
 * MVP-vf-F005 · Right-rail Activity Timeline card.
 *
 * Renders the last 10 audit_log rows scoped to this campaign.
 * Server-formatted timestamps + action labels — no client-side
 * formatter calls so the page stays lean.
 *
 * audit_log.action stores dot-namespaced strings ("campaign.kol.added")
 * but next-intl reserves dots for path nesting and rejects them as
 * leaf keys. ACTION_META below maps each audit string to both the
 * visible icon and the dot-free i18n lookup key (e.g.
 * "campaign_kol_added"); unknown actions fall back to the literal
 * audit string + a generic icon so a future, unlocalized action
 * still renders something readable.
 */
import { getFormatter, getTranslations } from "next-intl/server";

import { GlassPanel } from "@/components/common";

import type { ActivityRow } from "@/lib/campaigns/detail-insights";

interface Props {
  rows: ActivityRow[];
}

type ActionKey =
  | "campaign_created"
  | "campaign_kol_added"
  | "campaign_kol_removed"
  | "campaign_kol_fee_updated"
  | "campaign_kol_status_changed"
  | "campaign_status_changed"
  | "campaign_revenue_recorded"
  | "kol_bulk_added_to_campaign";

const ACTION_META: Record<string, { icon: string; key: ActionKey }> = {
  "campaign.created": { icon: "auto_awesome", key: "campaign_created" },
  "campaign.kol.added": { icon: "person_add", key: "campaign_kol_added" },
  "campaign.kol.removed": { icon: "person_remove", key: "campaign_kol_removed" },
  "campaign.kol.fee_updated": { icon: "payments", key: "campaign_kol_fee_updated" },
  "campaign.kol.status_changed": { icon: "swap_horiz", key: "campaign_kol_status_changed" },
  "campaign.status_changed": { icon: "flag", key: "campaign_status_changed" },
  "campaign.revenue_recorded": { icon: "trending_up", key: "campaign_revenue_recorded" },
  "kol.bulk_added_to_campaign": { icon: "group_add", key: "kol_bulk_added_to_campaign" },
};

export async function ActivityTimelineCard({ rows }: Props) {
  const t = await getTranslations("campaigns.detail.insights.activity");
  const tAction = await getTranslations(
    "campaigns.detail.insights.activity.actions"
  );
  const format = await getFormatter();

  return (
    <GlassPanel
      data-testid="campaign-activity-timeline"
      className="space-y-3 p-5"
    >
      <h4 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant">
        {t("heading")}
      </h4>
      {rows.length === 0 ? (
        <p className="text-sm text-on-surface-variant">{t("empty")}</p>
      ) : (
        <ol className="space-y-2 text-xs">
          {rows.map((row) => {
            const meta = ACTION_META[row.action];
            const icon = meta?.icon ?? "history";
            const label = meta ? tAction(meta.key) : row.action;
            const when = format.relativeTime(new Date(row.createdAt), {
              now: new Date(),
            });
            return (
              <li
                key={row.id}
                className="flex items-start gap-2"
                data-testid="campaign-activity-row"
                data-action={row.action}
              >
                <span
                  className="material-symbols-outlined mt-0.5 text-cyan"
                  aria-hidden
                >
                  {icon}
                </span>
                <div className="flex-1">
                  <p className="text-on-surface">{label}</p>
                  <p className="text-on-surface-variant">
                    {row.actorName ? `${row.actorName} · ` : ""}
                    {when}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </GlassPanel>
  );
}

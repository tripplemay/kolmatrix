/**
 * MVP-vf-F005 · Right-rail Activity Timeline card.
 *
 * Renders the last 10 audit_log rows scoped to this campaign.
 * Server-formatted timestamps + action labels — no client-side
 * formatter calls so the page stays lean.
 */
import { getFormatter, getTranslations } from "next-intl/server";

import { GlassPanel } from "@/components/common";

import type { ActivityRow } from "@/lib/campaigns/detail-insights";

interface Props {
  rows: ActivityRow[];
}

const ACTION_ICON: Record<string, string> = {
  "campaign.created": "auto_awesome",
  "campaign.kol.added": "person_add",
  "campaign.kol.removed": "person_remove",
  "campaign.kol.fee_updated": "payments",
  "campaign.kol.status_changed": "swap_horiz",
  "campaign.status_changed": "flag",
  "campaign.revenue_recorded": "trending_up",
  "kol.bulk_added_to_campaign": "group_add",
};

export async function ActivityTimelineCard({ rows }: Props) {
  const t = await getTranslations("campaigns.detail.insights.activity");
  const tAction = await getTranslations("campaigns.detail.insights.activity.actions");
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
            const icon = ACTION_ICON[row.action] ?? "history";
            const when = format.relativeTime(new Date(row.createdAt), {
              now: new Date(),
            });
            const label = tActionLabel(tAction, row.action);
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

function tActionLabel(
  t: Awaited<ReturnType<typeof getTranslations>>,
  action: string
): string {
  // next-intl throws on missing keys — guard with a defensive `has`.
  // The set of recognised actions is small and stable; new ones
  // surface as a literal action string until i18n catches up.
  const known = new Set(Object.keys(ACTION_ICON));
  if (!known.has(action)) return action;
  return t(action as Parameters<typeof t>[0]);
}

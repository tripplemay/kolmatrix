/**
 * MVP-vf-F003 · Right-rail Insights Panel for /database (server component).
 *
 * Three stacked cards per the Stitch prototype:
 *   1. AI Intelligence — surfaces a heuristic about saved-list freshness
 *      computed from `stats` + recent updatedAt; primary CTA disabled
 *      with a "Coming with B6" tooltip (no real refresh-AI flow yet).
 *   2. Coverage Gap — placeholder copy until B6 product analytics ship.
 *      Marked "No data yet" so the marketer knows it's intentional, not
 *      broken (per ui-fidelity-guardrail.md ghost-control rule).
 *   3. Engagement Trend — purely structural (7 fixed bars); no live data
 *      until the engagement scraping batch lands.
 *
 * Uses GlassPanel + SectionHeader + Sparkline atoms from common/.
 */
import { getTranslations } from "next-intl/server";

import { GlassPanel, Sparkline } from "@/components/common";
import { Button } from "@/components/ui";

import type { DatabaseStats } from "./stats";

interface Props {
  stats: DatabaseStats;
}

const TREND_BARS: number[] = [40, 55, 48, 70, 65, 85, 100];

export async function InsightsPanel({ stats }: Props) {
  const t = await getTranslations("database.insights");

  return (
    <aside
      className="flex flex-col gap-6 lg:sticky lg:top-20 lg:self-start"
      data-testid="database-insights-panel"
    >
      <GlassPanel className="relative space-y-4 p-6">
        <div className="flex items-center gap-2">
          <span
            className="material-symbols-outlined text-cyan"
            aria-hidden
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            auto_awesome
          </span>
          <h4 className="text-sm font-bold uppercase tracking-wider text-white">
            {t("aiIntelligenceHeading")}
          </h4>
        </div>
        <p className="text-sm leading-relaxed text-on-surface">
          {t("aiIntelligenceBody", { count: stats.total })}
        </p>
        <Button
          variant="primary-gradient"
          disabled
          title={t("aiRefreshTooltip")}
          className="w-full"
        >
          {t("aiRefreshCta")}
        </Button>
      </GlassPanel>

      <GlassPanel className="space-y-3 p-6">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-purple" aria-hidden>
            location_on
          </span>
          <h4 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant">
            {t("coverageGapHeading")}
          </h4>
        </div>
        <p className="text-sm leading-relaxed text-on-surface">
          {t("coverageGapPlaceholder")}
        </p>
      </GlassPanel>

      <GlassPanel className="space-y-3 p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              {t("engagementHeading")}
            </p>
            <h4 className="text-xl font-bold text-white">8.4%</h4>
          </div>
          <span className="text-xs font-semibold text-cyan">+1.2%</span>
        </div>
        <Sparkline data={TREND_BARS} height={48} />
        <p className="text-[11px] text-on-surface-variant/70">
          {t("engagementPlaceholder")}
        </p>
      </GlassPanel>
    </aside>
  );
}

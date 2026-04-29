import { getTranslations } from "next-intl/server";

import { GlassPanel, Sparkline } from "@/components/common";

import { DatabaseInsightsClient } from "./DatabaseInsightsClient";
import type { CoverageGapSummary, DatabaseStats } from "./stats";

interface Props {
  stats: DatabaseStats;
  coverage: CoverageGapSummary;
  tenantId: string;
  locale: string;
}

const TREND_BARS: number[] = [40, 55, 48, 70, 65, 85, 100];

function asPct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export async function InsightsPanel({ stats, coverage, tenantId, locale }: Props) {
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

        <DatabaseInsightsClient
          tenantId={tenantId}
          locale={locale}
          labels={{
            generate: t("aiGenerateCta"),
            refresh: t("aiRefreshCta"),
            loading: t("aiLoading"),
            cachedPrefix: t("aiCachedPrefix"),
            empty: t("aiEmpty"),
            error: t("aiError"),
          }}
        />
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

        {coverage.topMissing.length > 0 ? (
          <ul className="space-y-2 text-sm text-on-surface">
            {coverage.topMissing.map((row) => (
              <li key={row.category} className="rounded-lg border border-outline-variant/40 p-2">
                <p className="font-semibold text-white">{row.category}</p>
                <p className="text-xs text-on-surface-variant">
                  {t("coverageGapLine", {
                    actual: asPct(row.actualPct),
                    baseline: asPct(row.baselinePct),
                  })}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm leading-relaxed text-on-surface">{t("coverageGapEmpty")}</p>
        )}
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

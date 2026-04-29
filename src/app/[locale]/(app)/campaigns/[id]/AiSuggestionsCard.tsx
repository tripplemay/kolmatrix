/**
 * B7b-F002 · Right-rail AI Suggestions card.
 *
 * Server shell + client generator flow. The card renders campaign
 * context copy and delegates generation/caching/refresh to
 * AiSuggestionsClient.
 */
import { getTranslations } from "next-intl/server";

import { GlassPanel } from "@/components/common";

import { AiSuggestionsClient } from "./AiSuggestionsClient";

interface Props {
  tenantId: string;
  campaignId: string;
  locale: string;
  uncontactedKolCount: number;
}

export async function AiSuggestionsCard({
  tenantId,
  campaignId,
  locale,
  uncontactedKolCount,
}: Props) {
  const t = await getTranslations("campaigns.detail.insights.ai");

  return (
    <GlassPanel
      data-testid="campaign-ai-suggestions-card"
      className="space-y-3 p-5"
    >
      <div className="flex items-center gap-2">
        <span
          className="material-symbols-outlined text-cyan"
          style={{ fontVariationSettings: "'FILL' 1" }}
          aria-hidden
        >
          auto_awesome
        </span>
        <h4 className="text-sm font-bold uppercase tracking-wider text-white">
          {t("heading")}
        </h4>
      </div>
      <p className="text-sm text-on-surface-variant">
        {t("nextSteps", { count: uncontactedKolCount })}
      </p>

      <AiSuggestionsClient
        tenantId={tenantId}
        campaignId={campaignId}
        locale={locale}
        labels={{
          generate: t("generateCta"),
          refresh: t("refreshCta"),
          loading: t("loading"),
          cachedPrefix: t("cachedPrefix"),
          empty: t("empty"),
          error: t("error"),
        }}
      />
    </GlassPanel>
  );
}

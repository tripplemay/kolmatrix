/**
 * BL-065-F001 + F005 · /match AI recommendations sidebar.
 *
 * F001 shipped this as a UI shell (title + placeholder copy). F005
 * upgrades it to the real campaign-context AI surface (spec §3 F005,
 * decision-point #B Planner-tilt = "sidebar 起步, BL-066 升级为主面板"):
 *
 *   - Mounted only when the URL carries `?campaignId=<uuid>` AND the
 *     campaign resolves under the tenant (RLS-checked in page.tsx).
 *   - Reuses the BM2 AiSuggestionsClient (`/campaigns/[id]/
 *     AiSuggestionsClient.tsx`) verbatim — generation, 24h
 *     localStorage cache, refresh button, error fallback. The same
 *     `campaigns.detail.insights.ai.*` i18n bundle drives the labels;
 *     no new copy is needed.
 *   - Adds the C2 "为什么" placeholder hint (spec §F005 + decision-
 *     point §3 vision Cn-tier). Each suggestion already carries a
 *     description field; the hint label above it foreshadows the C3
 *     full explainability that BL-067 will ship.
 *
 * BL-066 will swap this sidebar for a full main-panel "accept / swap /
 * refine" workflow; for now the surface is a 320-px right column.
 */
import { getTranslations } from "next-intl/server";

import { AiSuggestionsClient } from "@/app/[locale]/(app)/campaigns/[id]/AiSuggestionsClient";

interface Props {
  campaignId: string;
  tenantId: string;
  locale: string;
  campaignName: string;
}

export async function AiSuggestionsSidebar({
  campaignId,
  tenantId,
  locale,
  campaignName,
}: Props) {
  const t = await getTranslations("match.aiSidebar");
  const tAi = await getTranslations("campaigns.detail.insights.ai");

  return (
    <aside
      className="glass-panel rounded-2xl border border-cyan/15 bg-cyan/5 p-5"
      data-testid="match-ai-sidebar"
      data-campaign-id={campaignId}
      aria-label={t("title")}
    >
      <div className="mb-3 flex items-center gap-2">
        <span
          className="material-symbols-outlined text-[18px] text-cyan"
          aria-hidden
        >
          auto_awesome
        </span>
        <h2 className="text-sm font-bold tracking-wide text-cyan uppercase">
          {t("title")}
        </h2>
      </div>

      <p
        className="mb-3 text-xs font-medium text-white"
        data-testid="match-ai-sidebar-campaign-name"
      >
        {t("withCampaign", { name: campaignName })}
      </p>

      {/* C2 placeholder "为什么": each AI suggestion's description is the
          shallow explanation. The hint label primes the marketer so the
          BL-067 C3 upgrade (full per-suggestion explainability) feels
          continuous. */}
      <p
        className="mb-3 text-[10px] uppercase tracking-wider text-on-surface-variant/70"
        data-testid="match-ai-sidebar-why-hint"
      >
        {t("whyHint")}
      </p>

      <AiSuggestionsClient
        tenantId={tenantId}
        campaignId={campaignId}
        locale={locale}
        labels={{
          generate: tAi("generateCta"),
          refresh: tAi("refreshCta"),
          loading: tAi("loading"),
          cachedPrefix: tAi("cachedPrefix"),
          empty: tAi("empty"),
          error: tAi("error"),
        }}
      />
    </aside>
  );
}

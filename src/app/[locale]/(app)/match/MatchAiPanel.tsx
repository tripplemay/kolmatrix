/**
 * BL-084-F006 · AI Match Panel — server component (data seeder).
 *
 * Fetches the three columns' initial data and hands them to the client:
 *   - 推荐池 (suggested): getCampaignSuggestions (F004 — cosine + LLM rerank,
 *     24h cache, excludes already-decided KOLs)
 *   - 已接受 (accepted) / 候补池 (swap_pool): kol_campaign rows joined to KOL
 *     metadata, RLS-scoped
 *
 * Also builds the BL-067 DetailedExplanationDialog labels (reusing the
 * existing campaigns.detail.explainability.* bundle — no new copy).
 */
import { getTranslations } from "next-intl/server";

import { withTenant } from "@/lib/db";

import { getCampaignSuggestions } from "./server-actions/get-campaign-suggestions";
import { MatchAiPanelClient } from "./MatchAiPanelClient";
import type { PanelCard } from "./MatchAiKolCard";

interface Props {
  campaignId: string;
  tenantId: string;
  locale: string;
}

interface KolCampaignRow {
  suggestionStatus: string | null;
  matchScore: number | null;
  kol: {
    id: string;
    displayName: string;
    handle: string;
    platform: string;
    avatarUrl: string | null;
    followerCount: number;
    countryCode: string | null;
    categories: string[];
  };
}

function rowToCard(row: KolCampaignRow): PanelCard {
  return {
    id: row.kol.id,
    displayName: row.kol.displayName,
    handle: row.kol.handle,
    platform: row.kol.platform,
    avatarUrl: row.kol.avatarUrl,
    followerCount: row.kol.followerCount,
    countryCode: row.kol.countryCode,
    categories: row.kol.categories ?? [],
    matchScore: row.matchScore,
    matchReason: null,
  };
}

export async function MatchAiPanel({ campaignId, tenantId, locale }: Props) {
  const t = await getTranslations({ locale, namespace: "match.aiPanel" });
  const tDetail = await getTranslations({
    locale,
    namespace: "campaigns.detail",
  });

  // Suggested column (F004).
  const suggestionsResult = await getCampaignSuggestions({ campaignId });

  // Accepted + swap columns from kol_campaign.
  let decidedRows: KolCampaignRow[] = [];
  try {
    decidedRows = (await withTenant(tenantId, (tx) =>
      tx.kolCampaign.findMany({
        where: {
          campaignId,
          suggestionStatus: { in: ["accepted", "swap_pool"] },
        },
        select: {
          suggestionStatus: true,
          matchScore: true,
          kol: {
            select: {
              id: true,
              displayName: true,
              handle: true,
              platform: true,
              avatarUrl: true,
              followerCount: true,
              countryCode: true,
              categories: true,
            },
          },
        },
        orderBy: { decidedAt: "desc" },
      }),
    )) as KolCampaignRow[];
  } catch (err) {
    console.error("[MatchAiPanel] decided columns fetch failed:", err);
  }

  const initialAccepted = decidedRows
    .filter((r) => r.suggestionStatus === "accepted")
    .map(rowToCard);
  const initialSwap = decidedRows
    .filter((r) => r.suggestionStatus === "swap_pool")
    .map(rowToCard);

  const initialSuggested: PanelCard[] = suggestionsResult.ok
    ? suggestionsResult.data.suggestions.map((s) => ({
        id: s.id,
        displayName: s.displayName,
        handle: s.handle,
        platform: s.platform,
        avatarUrl: s.avatarUrl,
        followerCount: s.followerCount,
        countryCode: s.countryCode,
        categories: s.categories,
        matchScore: s.matchScore,
        matchReason: s.matchReason,
      }))
    : [];

  const generatedAt = suggestionsResult.ok
    ? suggestionsResult.data.generatedAt
    : null;
  const rerankFallback = suggestionsResult.ok
    ? suggestionsResult.data.rerankFallback
    : false;

  // Surface a hard error (product missing / not found) above the columns.
  const errorBanner =
    !suggestionsResult.ok && suggestionsResult.error === "product_missing"
      ? t("errorProductMissing")
      : !suggestionsResult.ok &&
          suggestionsResult.error === "campaign_not_found"
        ? t("errorCampaignNotFound")
        : null;

  const dialogLabels = {
    dialogTitle: tDetail.raw("explainability.dialogTitle") as string,
    loading: tDetail("explainability.loading"),
    unavailable: tDetail("explainability.unavailable"),
    capExhaustedToast: tDetail("explainability.capExhaustedToast"),
    closeCta: tDetail("explainability.closeCta"),
    segments: {
      matchScore: {
        title: tDetail("explainability.segments.matchScore.title"),
      },
      categoryFit: {
        title: tDetail("explainability.segments.categoryFit.title"),
      },
      recentActivity: {
        title: tDetail("explainability.segments.recentActivity.title"),
      },
      audienceFit: {
        title: tDetail("explainability.segments.audienceFit.title"),
      },
      brandHistory: {
        title: tDetail("explainability.segments.brandHistory.title"),
      },
    },
  };

  return (
    <div className="flex flex-col gap-4">
      {errorBanner ? (
        <p
          data-testid="ai-panel-error"
          className="rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-300"
        >
          {errorBanner}
        </p>
      ) : null}
      <MatchAiPanelClient
        campaignId={campaignId}
        locale={locale}
        initialSuggested={initialSuggested}
        initialAccepted={initialAccepted}
        initialSwap={initialSwap}
        generatedAt={generatedAt}
        rerankFallback={rerankFallback}
        dialogLabels={dialogLabels}
      />
    </div>
  );
}

import { getTranslations } from "next-intl/server";

import { GlassPanel } from "@/components/common";

interface Props {
  locale: string;
  firstCampaignId?: string;
}

export async function AiSuggestionsCard({ locale, firstCampaignId }: Props) {
  const t = await getTranslations("campaigns.aiSuggestions");
  const href = firstCampaignId ? `/${locale}/campaigns/${firstCampaignId}` : `/${locale}/discovery`;
  return (
    <GlassPanel data-testid="campaigns-ai-suggestions" className="space-y-3 p-5">
      <div className="flex items-center gap-2">
        <span
          className="material-symbols-outlined text-cyan"
          style={{ fontVariationSettings: "'FILL' 1" }}
          aria-hidden
        >
          auto_awesome
        </span>
        <h4 className="text-sm font-bold tracking-wider text-white uppercase">{t("heading")}</h4>
      </div>
      <p className="text-on-surface-variant text-sm">{t("body")}</p>
      <a
        href={href}
        data-testid="campaigns-ai-suggestions-cta"
        className="text-cyan inline-flex items-center gap-1 text-xs font-bold tracking-widest uppercase hover:text-white"
      >
        {t("cta")}
        <span className="material-symbols-outlined text-sm" aria-hidden>
          arrow_forward
        </span>
      </a>
    </GlassPanel>
  );
}

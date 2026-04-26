/**
 * MVP-vf-F005 · Right-rail AI Suggestions card.
 *
 * Static MVP placeholder per F005 acceptance: hardcoded copy + a
 * jump-off link to /outreach pre-filtered to the current campaign so
 * the marketer can act on uncontacted KOLs immediately. The "Run AI
 * match" button is disabled with a tooltip pointing at the B2 batch.
 */
import { getTranslations } from "next-intl/server";

import { GlassPanel } from "@/components/common";
import { Button } from "@/components/ui";

interface Props {
  campaignId: string;
  locale: string;
  uncontactedKolCount: number;
}

export async function AiSuggestionsCard({
  campaignId,
  locale,
  uncontactedKolCount,
}: Props) {
  const t = await getTranslations("campaigns.detail.insights.ai");
  const outreachHref = `/${locale}/outreach?campaignId=${campaignId}`;
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
      <div className="flex flex-col gap-2">
        <a
          href={outreachHref}
          data-testid="campaign-ai-suggestions-outreach"
          className="gradient-cta inline-flex h-9 items-center justify-center gap-1 rounded-lg px-3 text-xs font-bold text-on-primary"
        >
          {t("outreachCta")}
          <span className="material-symbols-outlined text-sm" aria-hidden>
            arrow_forward
          </span>
        </a>
        <Button
          variant="ghost"
          disabled
          title={t("runMatchTooltip")}
          data-testid="campaign-ai-run-match"
          size="sm"
        >
          {t("runMatchCta")}
        </Button>
      </div>
    </GlassPanel>
  );
}

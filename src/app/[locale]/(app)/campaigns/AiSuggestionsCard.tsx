/**
 * MVP-vf-F004 · Static AI Suggestions card on /campaigns.
 *
 * Per F004 acceptance, this is a hardcoded copy + link to /discovery
 * — the live AI matching engine ships with B2. Marked with the
 * "Coming with B2" tag so the marketer doesn't expect interactive AI
 * here.
 */
import { getTranslations } from "next-intl/server";

import { GlassPanel } from "@/components/common";

interface Props {
  locale: string;
}

export async function AiSuggestionsCard({ locale }: Props) {
  const t = await getTranslations("campaigns.aiSuggestions");
  return (
    <GlassPanel
      data-testid="campaigns-ai-suggestions"
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
        <span className="ml-auto rounded-full border border-purple/30 bg-purple/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-purple">
          {t("comingTag")}
        </span>
      </div>
      <p className="text-sm text-on-surface-variant">{t("body")}</p>
      <a
        href={`/${locale}/discovery`}
        data-testid="campaigns-ai-suggestions-cta"
        className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-cyan hover:text-white"
      >
        {t("cta")}
        <span className="material-symbols-outlined text-sm" aria-hidden>
          arrow_forward
        </span>
      </a>
    </GlassPanel>
  );
}

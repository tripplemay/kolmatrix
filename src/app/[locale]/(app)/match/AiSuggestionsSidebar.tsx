/**
 * BL-065-F001 · /match AI recommendations sidebar — UI shell only.
 *
 * Mounted in the right column when `?campaignId=xxx` is present in the
 * URL. F005 will swap the placeholder body for the actual AI-suggested
 * top-N list (current AiSuggestionsClient logic from /campaigns/[id]
 * gets generalized into a sidebar form). C2-shallow "为什么" copy lives
 * here too once F005 wires it; C3 full explainability is BL-067.
 *
 * Server component so the heading + placeholder render server-side; the
 * client AI call lands in F005 inside its own boundary.
 */
import { getTranslations } from "next-intl/server";

interface Props {
  campaignId: string;
}

export async function AiSuggestionsSidebar({ campaignId }: Props) {
  const t = await getTranslations("match.aiSidebar");

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
      <p className="text-xs text-on-surface-variant">{t("placeholder")}</p>
      <p
        className="mt-3 rounded border border-cyan-fixed/20 bg-cyan-fixed/5 px-2 py-1 text-[10px] uppercase tracking-wide text-cyan-fixed"
        data-testid="match-ai-sidebar-shell-tag"
      >
        {t("shellTag")}
      </p>
    </aside>
  );
}

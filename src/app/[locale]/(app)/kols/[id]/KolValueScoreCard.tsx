/**
 * MVP-vf-F006 · Right-rail value score card.
 *
 * Big cyan-glow score with collapsible scoring breakdown. Pure
 * presentation; the score itself is computed upstream during seeding.
 */
import { getTranslations } from "next-intl/server";

interface Props {
  valueScore: number | null;
}

export async function KolValueScoreCard({ valueScore }: Props) {
  const t = await getTranslations("kolProfile.overview");
  return (
    <div
      className="glass-panel ambient-glow rounded-2xl border border-cyan/20 p-6 text-center"
      data-testid="kol-value-score-card"
    >
      <p className="text-[11px] font-bold uppercase tracking-wider text-cyan-fixed">
        {t("valueScoreLabel")}
      </p>
      {valueScore != null ? (
        <>
          <p className="mt-2 text-5xl font-extrabold text-cyan">{valueScore}</p>
          <p className="mt-3 text-xs text-on-surface-variant">
            {t("valueScoreCaption")}
          </p>
          <details className="mt-4 text-left text-[11px] text-on-surface-variant">
            <summary className="cursor-pointer select-none text-cyan-fixed">
              {t("valueBreakdownTitle")}
            </summary>
            <ul className="mt-2 space-y-1 pl-3">
              <li>• {t("valueBreakdownFollowers")}</li>
              <li>• {t("valueBreakdownEngagement")}</li>
              <li>• {t("valueBreakdownCategories")}</li>
              <li>• {t("valueBreakdownNormalize")}</li>
            </ul>
          </details>
        </>
      ) : (
        <p className="mt-2 text-xs text-on-surface-variant/70">
          {t("valueEmpty")}
        </p>
      )}
    </div>
  );
}

/**
 * MVP-vf-F002 · Discovery empty result state (server component).
 *
 * Pulled out of page.tsx so the parent file stays under the UI-fidelity
 * className threshold. Pure presentation — no DB or session work here.
 */
import { getTranslations } from "next-intl/server";

export async function EmptyState() {
  const t = await getTranslations("discovery.emptyState");

  return (
    <div
      className="glass-panel rounded-2xl border border-on-surface/5 p-10 text-center"
      data-testid="discovery-empty"
    >
      <h2 className="text-lg font-semibold text-white">{t("title")}</h2>
      <div className="mt-3 inline-flex items-start gap-2 rounded-lg border border-cyan/20 bg-cyan/5 px-4 py-3 text-left text-[12px] text-on-surface-variant">
        <span
          className="material-symbols-outlined mt-0.5 text-cyan"
          aria-hidden
        >
          lightbulb
        </span>
        <div>
          <p className="font-semibold text-cyan-fixed">{t("tipHeading")}</p>
          <p className="mt-1">{t("tipBody")}</p>
        </div>
      </div>
    </div>
  );
}

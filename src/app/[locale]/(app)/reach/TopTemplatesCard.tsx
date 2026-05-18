/**
 * BM2-F006 · Top templates card.
 *
 * Shows the 3 most-used EmailTemplates by EmailLog count, with a
 * per-template open-rate chip. Falls back to the F002 seeded system
 * template names when the tenant hasn't sent anything yet.
 */
import { getTranslations } from "next-intl/server";

import type {
  OutreachTemplateOption,
} from "@/lib/email/composer-data";
import type { TopTemplateRow } from "@/lib/email/analytics";

interface Props {
  rows: TopTemplateRow[];
  fallbackTemplates: OutreachTemplateOption[];
}

export async function TopTemplatesCard({ rows, fallbackTemplates }: Props) {
  const t = await getTranslations("outreach.topTemplates");

  const hasData = rows.length > 0;
  const displayRows = hasData
    ? rows
    : fallbackTemplates.slice(0, 3).map((tpl) => ({
        templateId: tpl.id,
        name: tpl.name,
        usage: 0,
        openRate: null as number | null,
      }));

  return (
    <section
      data-testid="outreach-top-templates"
      className="glass-panel flex flex-col gap-4 rounded-2xl border border-on-surface/5 p-6"
    >
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">{t("title")}</h3>
        <span
          className="material-symbols-outlined text-on-surface-variant"
          aria-hidden
        >
          auto_awesome
        </span>
      </header>
      <ul className="flex flex-col gap-3">
        {displayRows.map((r) => (
          <li
            key={r.templateId ?? "fallback-" + r.name}
            data-testid="outreach-top-template-row"
            className="flex items-center justify-between rounded-xl border border-white/5 bg-surface-high/40 px-3 py-3"
          >
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-white">
                {r.name ?? "—"}
              </span>
              <span className="text-[11px] text-on-surface-variant">
                {r.usage > 0
                  ? t("usedCount", { count: r.usage })
                  : t("noUsage")}
              </span>
            </div>
            <span
              className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                r.openRate == null
                  ? "border border-outline-variant text-on-surface-variant/60"
                  : "bg-cyan/10 text-cyan border border-cyan/20"
              }`}
            >
              {r.openRate == null ? t("noOpenRate") : `${r.openRate}% ${t("openRate")}`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

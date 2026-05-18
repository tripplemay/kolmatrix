/**
 * BM2-F006 · 30-day sending performance chart.
 *
 * Hand-rolled CSS bars per Planner adjudication §12 #D (drops the
 * recharts dependency until F009 ROI actually needs it). Bars for
 * daily sent count; a thin overlay bar shows opens.
 */
import { getTranslations } from "next-intl/server";

import type { Daily } from "@/lib/email/analytics";

interface Props {
  daily: Daily[];
}

export async function SendingPerformanceChart({ daily }: Props) {
  const t = await getTranslations("outreach.performance");
  const maxSent = Math.max(1, ...daily.map((d) => d.sent));
  const totals = {
    delivered: daily.reduce((acc, d) => acc + d.sent, 0),
    opened: daily.reduce((acc, d) => acc + d.opened, 0),
  };

  return (
    <section
      data-testid="outreach-performance-chart"
      className="glass-panel flex flex-col gap-6 rounded-2xl border border-on-surface/5 p-6"
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-white">{t("title")}</h2>
          <p className="text-xs text-on-surface-variant">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-cyan" />
            <span className="font-semibold text-on-surface-variant">
              {t("legendSent")}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-purple" />
            <span className="font-semibold text-on-surface-variant">
              {t("legendOpened")}
            </span>
          </div>
        </div>
      </header>

      <div
        className="flex h-44 w-full items-end gap-1"
        role="img"
        aria-label={t("ariaLabel")}
      >
        {daily.map((d, i) => {
          const sentPct = (d.sent / maxSent) * 100;
          const openedPct =
            d.sent > 0 ? (d.opened / d.sent) * sentPct : 0;
          return (
            <div
              key={d.day}
              className="relative flex flex-1 flex-col justify-end"
              data-testid="outreach-chart-bar"
              data-day={d.day}
              data-sent={d.sent}
            >
              <div
                className="w-full rounded-t bg-surface-high"
                style={{ height: `${Math.max(sentPct, 2)}%` }}
              />
              <div
                className="absolute bottom-0 left-0 right-0 rounded-t bg-cyan/30 border-t-2 border-cyan"
                style={{ height: `${Math.max(sentPct, 2)}%` }}
                aria-hidden
              />
              <div
                className="absolute bottom-0 left-0 right-0 rounded-t bg-purple/40"
                style={{ height: `${Math.max(openedPct, 0)}%` }}
                aria-hidden
              />
              {i === 0 || i === Math.floor(daily.length / 2) || i === daily.length - 1 ? (
                <span className="pointer-events-none absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-on-surface-variant/60">
                  {d.day.slice(5)}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      <dl className="grid grid-cols-2 gap-4 border-t border-white/5 pt-4 md:grid-cols-4">
        <div>
          <dt className="mb-1 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            {t("statDelivered")}
          </dt>
          <dd className="text-lg font-bold text-white tabular-nums">
            {new Intl.NumberFormat("en-US").format(totals.delivered)}
          </dd>
        </div>
        <div>
          <dt className="mb-1 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            {t("statOpened")}
          </dt>
          <dd className="text-lg font-bold text-white tabular-nums">
            {new Intl.NumberFormat("en-US").format(totals.opened)}
          </dd>
        </div>
        <div>
          <dt className="mb-1 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            {t("statOpenRate")}
          </dt>
          <dd className="text-lg font-bold text-white tabular-nums">
            {totals.delivered > 0
              ? `${((totals.opened / totals.delivered) * 100).toFixed(1)}%`
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="mb-1 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            {t("statWindow")}
          </dt>
          <dd className="text-lg font-bold text-white">{t("statWindowValue")}</dd>
        </div>
      </dl>
    </section>
  );
}

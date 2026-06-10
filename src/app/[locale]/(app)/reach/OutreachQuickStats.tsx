/**
 * BM2-F006 · Quick Stats 5 KPI strip.
 *
 * Aggregated from EmailLog via lib/email/analytics.ts. Label copy
 * hints the 30-day window so users don't misread stale MVP seed
 * metrics as live tracking (per Planner adjudication §12.5 #3).
 */
import { getTranslations } from "next-intl/server";

import type { EmailQuickStats } from "@/lib/email/analytics";

interface Props {
  stats: EmailQuickStats;
}

function formatPercent(v: number | null): string {
  if (v == null) return "—";
  return `${v.toFixed(1)}%`;
}

function formatInt(v: number): string {
  return new Intl.NumberFormat("en-US").format(v);
}

export async function OutreachQuickStats({ stats }: Props) {
  const t = await getTranslations("outreach.quickStats");
  // BL-110-F004 — reply tracking isn't wired (inbound email = B4). When
  // there's no real reply data, show an honest "—" + "待上线(B4)" hint for
  // the Reply rate cell instead of a fabricated 0.0%.
  const cells: Array<{
    label: string;
    value: string;
    testId: string;
    tone?: "neutral" | "accent" | "error";
    hint?: string;
  }> = [
    {
      label: t("sentToday"),
      value: formatInt(stats.sentToday),
      testId: "outreach-kpi-sent-today",
    },
    {
      label: t("openRate"),
      value: formatPercent(stats.openRatePercent),
      testId: "outreach-kpi-open-rate",
      tone: "accent",
    },
    {
      label: t("replyRate"),
      value: stats.replyTrackingPending
        ? "—"
        : formatPercent(stats.replyRatePercent),
      testId: "outreach-kpi-reply-rate",
      tone: "accent",
      hint: stats.replyTrackingPending ? t("replyPending") : undefined,
    },
    {
      label: t("bounceRate"),
      value: formatPercent(stats.bounceRatePercent),
      testId: "outreach-kpi-bounce-rate",
      tone: "error",
    },
    {
      label: t("deliverability"),
      value: formatPercent(stats.deliverabilityPercent),
      testId: "outreach-kpi-deliverability",
      tone: "accent",
    },
  ];

  return (
    <section
      data-testid="outreach-quick-stats"
      className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5"
    >
      {cells.map((c) => (
        <div
          key={c.testId}
          data-testid={c.testId}
          className="rounded-2xl border border-white/5 bg-surface-low/60 p-5"
        >
          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            {c.label}
          </p>
          <p
            className={`text-2xl font-extrabold tabular-nums ${
              c.tone === "accent"
                ? "text-cyan"
                : c.tone === "error" && c.value !== "—"
                  ? "text-white"
                  : "text-white"
            }`}
          >
            {c.value}
          </p>
          <p
            className="mt-1 text-[10px] text-on-surface-variant/70"
            data-testid={c.hint ? `${c.testId}-hint` : undefined}
          >
            {c.hint ?? t("windowHint")}
          </p>
        </div>
      ))}
    </section>
  );
}

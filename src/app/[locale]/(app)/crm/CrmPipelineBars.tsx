/**
 * BM2-F007 · Pipeline by stage horizontal bars (Stitch B-left).
 *
 * Each bar is a `<Link>` to `/crm?status=<status>` (BL-072-F006 lock A
 * re-aimed from the deprecated `/database` route to the CRM workspace
 * the bars belong to). Long-term gets the cyan highlight +
 * animate-pulse; paused/terminated render as smaller secondary bars
 * below the primary 4 stages, mirroring the design.
 */
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import type { StageBucket } from "@/lib/crm/aggregate";
import type { RelationshipStatus } from "@/lib/kol/filters";

interface Props {
  buckets: StageBucket[];
  locale: string;
}

const PRIMARY: RelationshipStatus[] = [
  "prospect",
  "first_contact",
  "negotiating",
  "long_term",
];
const SECONDARY: RelationshipStatus[] = ["paused", "terminated"];

const TONE: Record<RelationshipStatus, { fill: string; track: string; emphasis?: boolean }> = {
  prospect: { fill: "bg-gradient-to-r from-slate-600 to-slate-400", track: "bg-surface-high" },
  first_contact: { fill: "bg-cyan/40", track: "bg-surface-high" },
  negotiating: { fill: "bg-cyan/70", track: "bg-surface-high" },
  long_term: {
    fill: "bg-cyan",
    track: "bg-surface-high shadow-[0_0_15px_rgba(0,229,255,0.1)]",
    emphasis: true,
  },
  paused: { fill: "bg-warning/40", track: "bg-surface-high" },
  terminated: { fill: "bg-error/30", track: "bg-surface-high" },
};

export async function CrmPipelineBars({ buckets, locale }: Props) {
  const t = await getTranslations("crm.pipeline");
  const tStatus = await getTranslations("relationshipStatus");
  const total = buckets.reduce((acc, b) => acc + b.count, 0);

  const rowFor = (status: RelationshipStatus, primary: boolean) => {
    const bucket = buckets.find((b) => b.status === status)!;
    const pct =
      total > 0 ? Math.max(2, Math.round((bucket.count / total) * 100)) : 2;
    const tone = TONE[status];
    return (
      <Link
        key={status}
        href={`/${locale}/crm?status=${status}`}
        prefetch={false}
        data-testid="crm-pipeline-bar"
        data-status={status}
        className="group flex flex-col gap-2"
      >
        <div className="flex justify-between text-xs font-bold">
          <span
            className={
              tone.emphasis
                ? "text-cyan"
                : primary
                  ? "text-on-surface-variant group-hover:text-on-surface"
                  : "text-on-surface-variant/70"
            }
          >
            {tStatus(status)}
          </span>
          <span className="text-white tabular-nums">
            {t("rowCount", {
              count: bucket.count,
              percent:
                total > 0
                  ? Math.round((bucket.count / total) * 100)
                  : 0,
            })}
          </span>
        </div>
        <div
          className={`h-${primary ? (tone.emphasis ? "4" : "3") : "2"} w-full overflow-hidden rounded-full ${tone.track}`}
        >
          <div
            className={`h-full rounded-full ${tone.fill} transition-[width] duration-500 ${tone.emphasis ? "relative" : ""}`}
            style={{ width: `${pct}%` }}
          >
            {tone.emphasis ? (
              <span
                aria-hidden
                className="absolute inset-0 animate-pulse bg-white/15"
              />
            ) : null}
          </div>
        </div>
      </Link>
    );
  };

  return (
    <section
      data-testid="crm-pipeline-bars"
      className="rounded-2xl border border-white/5 bg-surface-low/60 p-6"
    >
      <header className="mb-8 flex items-center gap-2">
        <h2 className="text-lg font-bold text-white">{t("title")}</h2>
        <span className="rounded bg-surface-high px-1.5 py-0.5 text-[10px] font-medium text-on-surface-variant">
          {t("liveLabel")}
        </span>
      </header>
      <div className="space-y-6">
        {PRIMARY.map((s) => rowFor(s, true))}
        <div className="grid grid-cols-2 gap-6">{SECONDARY.map((s) => rowFor(s, false))}</div>
      </div>
    </section>
  );
}

/**
 * BM2-F007 · 4-step funnel (Stitch B-right).
 *
 * Steps: Total Pipeline → Contacted → Negotiated → Long-term Partners.
 * Each step shrinks horizontally to telegraph drop-off, with the
 * conversion percent off to the right (skipped on the apex step).
 */
import { getTranslations } from "next-intl/server";

import type { FunnelStep } from "@/lib/crm/aggregate";

interface Props {
  steps: FunnelStep[];
}

const WIDTHS: Record<FunnelStep["key"], string> = {
  totalPipeline: "w-[85%]",
  contacted: "w-[75%]",
  negotiated: "w-[60%]",
  longTerm: "w-[45%]",
};
const TONES: Record<FunnelStep["key"], string> = {
  totalPipeline: "bg-surface-variant/40 text-on-surface-variant",
  contacted: "bg-cyan/20 text-cyan",
  negotiated: "bg-cyan/40 text-cyan",
  longTerm:
    "bg-cyan text-[#00363d] shadow-[0_10px_30px_rgba(0,229,255,0.2)]",
};

export async function CrmFunnel({ steps }: Props) {
  const t = await getTranslations("crm.funnel");

  return (
    <section
      data-testid="crm-funnel"
      className="flex flex-col rounded-2xl border border-white/5 bg-surface-low/60 p-6"
    >
      <header className="mb-8">
        <h2 className="text-lg font-bold text-white">{t("title")}</h2>
      </header>
      <div className="flex grow flex-col items-center gap-1">
        {steps.map((step, i) => {
          const isApex = i === steps.length - 1;
          const heightCls = isApex ? "h-18" : "h-16";
          const cornerCls =
            i === 0
              ? "rounded-t-xl"
              : isApex
                ? "rounded-b-xl"
                : "";
          return (
            <div
              key={step.key}
              data-testid="crm-funnel-step"
              data-step={step.key}
              className={`relative flex ${WIDTHS[step.key]} ${heightCls} items-center justify-between px-6 ${TONES[step.key]} ${cornerCls}`}
            >
              <span
                className={
                  isApex
                    ? "text-[11px] font-extrabold uppercase tracking-tight leading-tight"
                    : "text-xs font-bold"
                }
              >
                {t(`labels.${step.key}` as Parameters<typeof t>[0])}
              </span>
              <span
                className={
                  isApex
                    ? "text-xl font-black tabular-nums"
                    : "text-sm font-bold tabular-nums text-white"
                }
              >
                {new Intl.NumberFormat("en-US").format(step.count)}
              </span>
              {step.conversionPercent != null ? (
                <div className="absolute -right-16 hidden flex-col items-start text-cyan md:flex">
                  <span className="text-[10px] font-bold">
                    {step.conversionPercent}%
                  </span>
                  <span
                    aria-hidden
                    className="material-symbols-outlined text-xs"
                  >
                    {isApex ? "done_all" : "subdirectory_arrow_right"}
                  </span>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

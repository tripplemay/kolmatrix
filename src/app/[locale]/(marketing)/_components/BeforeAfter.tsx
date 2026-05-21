"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { useScrollProgress } from "@/components/landing/useScrollProgress";

interface Row {
  key: "discover" | "match" | "email" | "review";
  icon: string;
}

const ROWS: ReadonlyArray<Row> = [
  { key: "discover", icon: "search" },
  { key: "match", icon: "auto_awesome" },
  { key: "email", icon: "outgoing_mail" },
  { key: "review", icon: "insights" },
];

export function BeforeAfter() {
  const t = useTranslations("landing.beforeAfter");
  const sectionRef = useRef<HTMLDivElement>(null);
  const progress = useScrollProgress(sectionRef);

  // Drive 4-row highlight from progress. Each row activates when progress
  // crosses (idx + 0.5) / ROWS.length, so they light up sequentially.
  const activeIdx = Math.floor(progress * ROWS.length);

  return (
    <section
      ref={sectionRef}
      data-testid="landing-before-after"
      data-parallax="sticky"
      className="bg-surface text-on-surface px-6 py-32 lg:px-12"
      style={{ minHeight: "180vh" }}
    >
      <div className="mx-auto max-w-6xl sticky top-24" data-parallax="sticky">
        <div className="flex flex-col items-center gap-3 text-center">
          <h2 className="font-geist text-3xl font-bold tracking-tight text-white lg:text-4xl">
            {t("sectionTitle")}
          </h2>
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-purple/40 bg-purple/10 px-3 py-1 font-geist-mono text-[11px] font-semibold uppercase tracking-[0.15em] text-purple-fixed"
            data-testid="landing-before-after-demo-badge"
          >
            <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
              science
            </span>
            {t("demoBadge")}
          </span>
        </div>

        <div className="mt-12 overflow-hidden rounded-2xl border border-cyan/15 relative">
          {/* Progress line — vertical cyan track on the left, fills as user scrolls */}
          <div className="absolute left-0 top-0 w-[3px] bg-cyan/15 h-full overflow-hidden">
            <div
              className="bg-cyan shadow-[0_0_12px_var(--glow-cyan)] transition-all duration-300"
              style={{ height: `${progress * 100}%`, width: "100%" }}
            />
          </div>

          {/* Header */}
          <div className="hidden grid-cols-[1.4fr_1fr_1fr] gap-4 border-b border-cyan/15 bg-surface-low px-7 py-4 font-geist-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant md:grid">
            <div>{t("colTask")}</div>
            <div>{t("colBefore")}</div>
            <div className="text-cyan">{t("colAfter")}</div>
          </div>

          {/* Rows */}
          {ROWS.map(({ key, icon }, idx) => {
            const isActive = idx <= activeIdx;
            return (
              <div
                key={key}
                data-testid={`landing-before-after-${key}`}
                data-active={isActive}
                className={`grid grid-cols-1 gap-3 px-7 py-6 md:grid-cols-[1.4fr_1fr_1fr] md:gap-4 transition-all duration-500 ${
                  idx < ROWS.length - 1 ? "border-b border-cyan/10" : ""
                } ${idx % 2 === 0 ? "bg-surface" : "bg-surface-low"} ${
                  isActive ? "opacity-100" : "opacity-50"
                }`}
              >
                <div className="flex items-center gap-3 font-geist text-base font-semibold text-white">
                  <span
                    className={`material-symbols-outlined text-[22px] transition-all duration-500 ${
                      isActive ? "text-cyan scale-110" : "text-on-surface-variant scale-100"
                    }`}
                    aria-hidden="true"
                  >
                    {icon}
                  </span>
                  {t(`rows.${key}.task`)}
                </div>
                <div className="text-sm text-on-surface-variant/70 line-through decoration-on-surface-variant/40">
                  <span className="md:hidden mr-2 font-geist-mono text-xs uppercase tracking-wider text-on-surface-variant/50 no-underline">
                    {t("colBefore")}:
                  </span>
                  {t(`rows.${key}.before`)}
                </div>
                <div
                  className={`text-sm font-medium transition-all duration-500 ${
                    isActive ? "text-cyan" : "text-on-surface-variant"
                  }`}
                >
                  <span className="md:hidden mr-2 font-geist-mono text-xs uppercase tracking-wider text-on-surface-variant/50 no-underline">
                    {t("colAfter")}:
                  </span>
                  {t(`rows.${key}.after`)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

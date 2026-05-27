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
      className="bg-surface text-on-surface px-6 lg:px-12"
      style={{ minHeight: "180vh", paddingTop: "var(--spacing-landing-section-y)", paddingBottom: "var(--spacing-landing-section-y)" }}
    >
      <div className="mx-auto max-w-6xl sticky top-24" data-parallax="sticky">
        <div className="flex flex-col items-center gap-3 text-center">
          <h2 className="font-geist text-landing-h2 font-bold leading-landing-tight tracking-landing-tight text-landing-ink">
            {t("sectionTitle")}
          </h2>
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-purple/40 bg-purple/10 px-3 py-1 font-geist-mono text-landing-eyebrow font-semibold uppercase tracking-landing-eyebrow text-purple-fixed"
            data-testid="landing-before-after-demo-badge"
          >
            <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
              science
            </span>
            {t("demoBadge")}
          </span>
        </div>

        <div className="mt-12 overflow-hidden rounded-[var(--radius-landing-card)] border border-cyan/15 relative bg-landing-canvas-elevated/40">
          {/* Progress line — vertical cyan track on the left, fills as user scrolls */}
          <div className="absolute left-0 top-0 w-[3px] bg-cyan/15 h-full overflow-hidden">
            <div
              className="bg-cyan shadow-[0_0_12px_var(--glow-cyan)] transition-all"
              style={{
                height: `${progress * 100}%`,
                width: "100%",
                transitionDuration: "var(--duration-landing-medium)",
                transitionTimingFunction: "var(--ease-landing-out)",
              }}
            />
          </div>

          {/* Header */}
          <div className="hidden grid-cols-[1.4fr_1fr_1fr] gap-4 border-b border-cyan/15 bg-surface-low px-7 py-4 font-geist-mono text-landing-eyebrow font-semibold uppercase tracking-landing-eyebrow text-landing-ink-muted md:grid">
            <div>{t("colTask")}</div>
            <div>{t("colBefore")}</div>
            <div className="text-cyan">{t("colAfter")}</div>
          </div>

          {/* Rows — F005 fix-round 1: dropped parent opacity-50 dimming
              (was killing text contrast below WCAG AA). Active/inactive
              visual distinction now via icon color + scale + "after" cell
              color + progress bar fill — no opacity-based dimming. */}
          {ROWS.map(({ key, icon }, idx) => {
            const isActive = idx <= activeIdx;
            return (
              <div
                key={key}
                data-testid={`landing-before-after-${key}`}
                data-active={isActive}
                className={`grid grid-cols-1 gap-3 px-7 py-6 md:grid-cols-[1.4fr_1fr_1fr] md:gap-4 ${
                  idx < ROWS.length - 1 ? "border-b border-cyan/10" : ""
                } ${idx % 2 === 0 ? "bg-surface" : "bg-surface-low"}`}
              >
                <div className="flex items-center gap-3 font-geist text-landing-body font-semibold text-landing-ink">
                  <span
                    className={`material-symbols-outlined text-[22px] ${
                      isActive ? "text-cyan" : "text-landing-ink-muted"
                    }`}
                    aria-hidden="true"
                    style={{
                      transition: "color var(--duration-landing-medium) var(--ease-landing-out), transform var(--duration-landing-medium) var(--ease-landing-out)",
                      transform: isActive ? "scale(1.12)" : "scale(1)",
                    }}
                  >
                    {icon}
                  </span>
                  {t(`rows.${key}.task`)}
                </div>
                <div className="text-landing-body text-landing-ink-muted/70 line-through decoration-landing-ink-muted/40">
                  <span className="md:hidden mr-2 font-geist-mono text-landing-eyebrow uppercase tracking-landing-eyebrow text-landing-ink-subtle no-underline">
                    {t("colBefore")}:
                  </span>
                  {t(`rows.${key}.before`)}
                </div>
                <div
                  className={`text-landing-body font-medium ${
                    isActive ? "text-cyan" : "text-landing-ink-muted"
                  }`}
                  style={{ transition: "color var(--duration-landing-medium) var(--ease-landing-out)" }}
                >
                  <span className="md:hidden mr-2 font-geist-mono text-landing-eyebrow uppercase tracking-landing-eyebrow text-landing-ink-subtle no-underline">
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

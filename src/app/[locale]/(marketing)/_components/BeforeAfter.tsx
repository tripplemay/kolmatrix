import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { landingAssetExists } from "./illustration-asset";

/**
 * BL-080-F003 · The scroll-driven before/after comparison table was
 * replaced by the AI "chaos vs. organized workspace" illustration
 * (A1 lock 2026-06-08). The section keeps its title + demo badge; the
 * illustration only renders when the PNG was delivered (fallback: render
 * just the heading rather than a broken image).
 */
const ILLUSTRATION = "/landing/illustrations/before-after-illustration.png";

export async function BeforeAfter() {
  const t = await getTranslations("landing.beforeAfter");
  const hasIllustration = landingAssetExists(ILLUSTRATION);

  return (
    <section
      data-testid="landing-before-after"
      data-parallax="sticky"
      className="bg-surface text-on-surface px-6 lg:px-12"
      style={{ paddingTop: "var(--spacing-landing-section-y)", paddingBottom: "var(--spacing-landing-section-y)" }}
    >
      <div className="mx-auto max-w-6xl">
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

        {hasIllustration && (
          <div className="mt-12 overflow-hidden rounded-[var(--radius-landing-card)] border border-cyan/15 bg-landing-canvas-elevated/40">
            <Image
              src={ILLUSTRATION}
              alt={t("illustrationAlt")}
              width={1376}
              height={768}
              quality={80}
              sizes="(max-width: 1200px) 100vw, 1056px"
              className="h-auto w-full"
              data-testid="landing-before-after-illustration"
            />
          </div>
        )}
      </div>
    </section>
  );
}

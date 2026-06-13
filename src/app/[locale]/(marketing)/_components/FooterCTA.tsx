import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { TrialLeadCta } from "./TrialLeadCta";

interface Props {
  locale: string;
}

/**
 * BL-114-F003 — Closing CTA panel (Stitch "Neural Velocity" prototype).
 * BL-115-F001 — primary CTA now opens the in-page trial modal; secondary
 * books a 1:1 demo via the real request-access?demo=1 flow.
 */
export async function FooterCTA({ locale }: Props) {
  const t = await getTranslations("landing.footerCta");

  return (
    <section
      data-testid="landing-footer-cta"
      data-analytics-section="cta"
      className="bg-navy-base px-6 py-24 lg:px-8 lg:py-32"
    >
      <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[24px] bg-surface-high p-12 text-center md:p-24">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 translate-y-1/3 bg-cyan/10 blur-[80px]"
        />
        <div className="relative z-10">
          <h2 className="mb-8 text-4xl font-extrabold tracking-tight text-white md:text-6xl">
            {t("sectionTitle")}
          </h2>
          <p className="mx-auto mb-12 max-w-xl text-lg text-on-surface-variant md:text-xl">
            {t("subtitle")}
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <TrialLeadCta
              ctaId="footer"
              label={t("ctaPrimary")}
              className="landing-cta-primary inline-flex items-center justify-center rounded-md px-10 py-5 text-lg font-extrabold"
            />
            <Link
              href={`/${locale}/request-access?demo=1`}
              data-analytics-cta="demo-footer"
              className="inline-flex items-center font-bold text-on-surface transition-colors duration-[var(--duration-landing-short)] hover:text-white"
              data-testid="landing-footer-cta-secondary"
            >
              {t("ctaSecondary")} →
            </Link>
          </div>
        </div>
      </div>
      <p className="mt-16 text-center font-landing-mono text-[10px] uppercase tracking-[0.2em] text-on-surface-variant/60">
        {t("footerLine")}
      </p>
    </section>
  );
}

import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ScrollFadeIn } from "@/components/landing/ScrollFadeIn";

interface Props {
  locale: string;
}

export async function FooterCTA({ locale }: Props) {
  const t = await getTranslations("landing.footerCta");

  return (
    <section
      data-testid="landing-footer-cta"
      className="relative overflow-hidden bg-surface text-on-surface px-6 lg:px-12"
      style={{ paddingTop: "var(--spacing-landing-section-y)", paddingBottom: "var(--spacing-landing-section-y)" }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan/40 to-transparent" />
      {/* Subtle hero-style mesh glow framing the final CTA */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 50%, color-mix(in srgb, var(--color-cyan) 8%, transparent), transparent 70%)",
        }}
      />
      <ScrollFadeIn>
        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <h2 className="cinematic-text font-geist text-landing-hero font-extrabold leading-landing-display tracking-landing-display">
            {t("sectionTitle")}
          </h2>
          <div className="mt-12 flex flex-wrap justify-center gap-3">
            <Link
              href={`/${locale}/request-access`}
              className="landing-cta-primary inline-flex items-center gap-2 rounded-full px-10 py-4 text-base font-semibold"
              data-testid="landing-footer-cta-primary"
            >
              {t("ctaPrimary")} →
            </Link>
            <Link
              href={`/${locale}/request-access?demo=1`}
              className="landing-cta-secondary inline-flex items-center gap-2 rounded-full px-10 py-4 text-base font-semibold"
              data-testid="landing-footer-cta-secondary"
            >
              {t("ctaSecondary")}
            </Link>
          </div>
          <div className="mt-20 font-geist-mono text-landing-eyebrow text-landing-ink-subtle uppercase tracking-landing-eyebrow">
            <p>{t("footerLine")}</p>
          </div>
        </div>
      </ScrollFadeIn>
    </section>
  );
}

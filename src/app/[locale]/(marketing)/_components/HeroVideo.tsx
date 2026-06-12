import Link from "next/link";
import { getTranslations } from "next-intl/server";

interface Props {
  locale: string;
}

export async function HeroVideo({ locale }: Props) {
  const t = await getTranslations("landing.hero");

  return (
    <section
      data-testid="landing-hero"
      data-parallax="hero"
      className="landing-mesh-hero overflow-hidden min-h-[100svh] flex items-center justify-center px-6 py-32 lg:px-12 lg:py-40"
    >
      {/* Pure CSS mesh background — no image asset. scroll-driven fade-in on entry */}
      <div className="landing-hero-fade-in max-w-4xl w-full text-center font-geist mx-auto">
        <div className="font-geist-mono text-landing-eyebrow tracking-landing-eyebrow text-cyan mb-8 uppercase">
          {t("eyebrow")}
        </div>
        <h1 className="cinematic-text font-extrabold text-landing-hero leading-landing-display tracking-landing-display">
          {t("title_line1")}
          <br />
          {t("title_line2")}
        </h1>
        <p className="mt-8 mx-auto max-w-xl text-landing-body-lg leading-landing-relaxed text-landing-ink-muted">
          {t("subtitle")}
        </p>
        <div className="mt-12 flex flex-wrap justify-center gap-4">
          <Link
            href={`/${locale}/request-access`}
            className="landing-cta-primary inline-flex items-center gap-2 rounded-full px-8 py-4 text-sm font-semibold"
            data-testid="landing-cta-primary"
          >
            {t("ctaPrimary")} →
          </Link>
          <Link
            href={`/${locale}/request-access?demo=1`}
            className="landing-cta-secondary inline-flex items-center gap-2 rounded-full px-8 py-4 text-sm font-semibold"
            data-testid="landing-cta-secondary"
          >
            {t("ctaSecondary")}
          </Link>
        </div>
        <p className="mt-20 font-geist-mono text-[10px] uppercase tracking-[0.3em] text-landing-ink-subtle">↓ Scroll to explore</p>
      </div>
    </section>
  );
}

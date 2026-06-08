import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { resolveLandingAsset } from "./illustration-asset";

interface Props {
  locale: string;
}

export async function HeroVideo({ locale }: Props) {
  const t = await getTranslations("landing.hero");
  // BL-080-F003 — the looping product-demo video is replaced by the AI
  // hero illustration (A1 lock 2026-06-08). Falls back to the BL-078 video
  // poster if the illustration PNG was not delivered. Static for every
  // motion preference, so no separate reduced-motion branch is needed.
  const heroSrc = resolveLandingAsset(
    "/landing/illustrations/hero-illustration.png",
    "/landing/hero/hero-poster.jpg"
  );

  return (
    <section
      data-testid="landing-hero"
      data-parallax="hero"
      className="landing-mesh-hero relative overflow-hidden min-h-screen flex items-center justify-center px-6 lg:px-12"
    >
      {/* Hero illustration — fills the section as a dimmed background layer.
          Priority load: this is the LCP element for the landing route. */}
      <Image
        src={heroSrc}
        alt={t("illustrationAlt")}
        fill
        priority
        quality={85}
        sizes="100vw"
        className="object-cover opacity-40"
        data-testid="landing-hero-illustration"
      />

      {/* Foreground content — scroll-driven fade-in on entry */}
      <div className="landing-hero-fade-in relative z-10 max-w-5xl text-center font-geist">
        <div className="font-geist-mono text-landing-eyebrow tracking-landing-eyebrow text-cyan mb-6 uppercase">
          {t("eyebrow")}
        </div>
        <h1 className="cinematic-text font-extrabold text-landing-hero leading-landing-display tracking-landing-display">
          {t("title_line1")}
          <br />
          {t("title_line2")}
        </h1>
        <p className="mt-8 mx-auto max-w-2xl text-landing-body-lg leading-landing-relaxed text-landing-ink-muted">
          {t("subtitle")}
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link
            href={`/${locale}/request-access`}
            className="landing-cta-primary inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold"
            data-testid="landing-cta-primary"
          >
            {t("ctaPrimary")} →
          </Link>
          <Link
            href={`/${locale}/request-access?demo=1`}
            className="landing-cta-secondary inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold"
            data-testid="landing-cta-secondary"
          >
            {t("ctaSecondary")}
          </Link>
        </div>
        <p className="mt-16 font-geist-mono text-[10px] uppercase tracking-[0.3em] text-landing-ink-subtle">↓ Scroll to explore</p>
      </div>
    </section>
  );
}

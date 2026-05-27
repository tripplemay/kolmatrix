import Image from "next/image";
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
      className="landing-mesh-hero relative overflow-hidden min-h-screen flex items-center justify-center px-6 lg:px-12"
    >
      {/* Looping product-demo video — fills the section as a background layer.
          Scroll-driven scale via .landing-hero-video-scale (Chrome/Safari);
          Firefox / 旧 Safari renders static end-state via @supports fallback. */}
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster="/landing/hero/hero-poster.jpg"
        aria-label={t("videoAlt")}
        className="landing-hero-video-scale absolute inset-0 w-full h-full object-cover opacity-40 motion-reduce:hidden"
        data-testid="landing-hero-video"
      >
        <source src="/landing/hero/hero-loop.webm" type="video/webm" />
        <source src="/landing/hero/hero-loop.mp4" type="video/mp4" />
      </video>

      {/* Reduced-motion fallback — static poster, only rendered when prefers-reduced-motion: reduce */}
      <Image
        src="/landing/hero/hero-poster.jpg"
        alt={t("videoAlt")}
        fill
        priority
        className="object-cover opacity-40 hidden motion-reduce:block"
        data-testid="landing-hero-poster-fallback"
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

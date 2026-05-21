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
      className="relative overflow-hidden bg-surface min-h-screen flex items-center justify-center px-6 lg:px-12"
    >
      {/* Cinematic mesh background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse at 25% 15%, rgba(0,229,255,0.35), transparent 50%),
            radial-gradient(ellipse at 75% 85%, rgba(157,80,255,0.32), transparent 50%),
            radial-gradient(ellipse at 50% 50%, rgba(0,229,255,0.08), transparent 70%),
            linear-gradient(180deg, var(--color-surface) 0%, var(--color-navy-deep) 60%, var(--color-surface) 100%)
          `,
        }}
      />

      {/* Looping product-demo video — fills the section as a background layer */}
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster="/landing/hero/hero-poster.jpg"
        aria-label={t("videoAlt")}
        className="absolute inset-0 w-full h-full object-cover opacity-40 motion-reduce:hidden"
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

      {/* Foreground content */}
      <div className="relative z-10 max-w-5xl text-center font-geist">
        <div className="font-geist-mono text-[11px] tracking-[0.35em] text-cyan mb-6 uppercase">
          {t("eyebrow")}
        </div>
        <h1 className="cinematic-text font-extrabold leading-[0.9] tracking-[-0.04em] text-[64px] sm:text-[96px] lg:text-[124px]">
          {t("title_line1")}
          <br />
          {t("title_line2")}
        </h1>
        <p className="mt-8 mx-auto max-w-2xl text-base sm:text-lg text-on-surface-variant">
          {t("subtitle")}
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link
            href={`/${locale}/request-access`}
            className="cta-glow-pulse inline-flex items-center gap-2 rounded-full bg-cyan px-7 py-3.5 text-sm font-semibold text-surface shadow-[0_0_24px_var(--glow-cyan)] hover:bg-cyan/90 transition"
            data-testid="landing-cta-primary"
          >
            {t("ctaPrimary")} →
          </Link>
          <Link
            href={`/${locale}/request-access?demo=1`}
            className="inline-flex items-center gap-2 rounded-full border border-cyan/40 bg-surface/40 backdrop-blur-sm px-7 py-3.5 text-sm font-semibold text-cyan hover:bg-cyan/10 transition"
            data-testid="landing-cta-secondary"
          >
            {t("ctaSecondary")}
          </Link>
        </div>
        <p className="mt-16 font-geist-mono text-[10px] uppercase tracking-[0.3em] text-on-surface-variant/60">↓ Scroll to explore</p>
      </div>
    </section>
  );
}

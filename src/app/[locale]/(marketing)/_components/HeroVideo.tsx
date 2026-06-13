import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

interface Props {
  locale: string;
}

/**
 * BL-114-F001 (redo) — Hero rebuilt to the Stitch "Neural Velocity"
 * prototype (design-draft/landing-stitch-prototype/code.html + screen.png):
 * cyan mono eyebrow, large display title with a gradient second line, lede,
 * gradient "Start free" CTA + "Book a demo" secondary, ambient glow blobs,
 * and the kept hero-illustration.png as a glass-framed dashboard preview.
 *
 * The earlier jina.ai variant (pure CSS mesh, no image) is superseded.
 */
export async function HeroVideo({ locale }: Props) {
  const t = await getTranslations("landing.hero");

  return (
    <section
      data-testid="landing-hero"
      className="relative overflow-hidden bg-navy-base px-6 pt-36 pb-24 text-center lg:px-8 lg:pt-48"
    >
      {/* Ambient glow blobs — decorative, behind content (照原型 body blobs) */}
      <div aria-hidden className="glow-blob -left-24 -top-48 h-[500px] w-[500px] bg-cyan" />
      <div aria-hidden className="glow-blob -right-48 top-1/4 h-[600px] w-[600px] bg-purple" />
      <div aria-hidden className="glow-blob bottom-0 left-1/3 h-[400px] w-[400px] bg-cyan" />

      <div className="landing-hero-fade-in relative z-10 mx-auto max-w-5xl">
        <div className="mb-6 inline-block rounded-full bg-surface-low px-4 py-1.5">
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-cyan-fixed-dim">
            {t("eyebrow")}
          </span>
        </div>

        <h1 className="mx-auto max-w-4xl text-5xl font-extrabold leading-[1.1] tracking-landing-tight text-white md:text-7xl">
          {t("title_line1")}
          <br />
          <span className="gradient-text">{t("title_line2")}</span>
        </h1>

        <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-on-surface-variant md:text-xl">
          {t("subtitle")}
        </p>

        <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href={`/${locale}/request-access`}
            className="landing-cta-primary inline-flex w-full items-center justify-center rounded-md px-8 py-4 text-base font-bold sm:w-auto"
            data-testid="landing-cta-primary"
          >
            {t("ctaPrimary")}
          </Link>
          <Link
            href={`/${locale}/request-access?demo=1`}
            className="inline-flex w-full items-center justify-center rounded-md bg-surface-high px-8 py-4 text-base font-bold text-white transition-colors duration-[var(--duration-landing-short)] hover:bg-surface-highest sm:w-auto"
            data-testid="landing-cta-secondary"
          >
            {t("ctaSecondary")}
          </Link>
        </div>

        {/* Dashboard preview — kept hero-illustration.png, glass-framed with a
            bottom fade into the page background (照原型 dashboard preview). */}
        <div className="relative mx-auto mt-16 max-w-5xl md:mt-24">
          <div className="rounded-lg bg-surface-low p-3 shadow-2xl shadow-cyan/10 md:p-4">
            <div className="relative h-[240px] w-full overflow-hidden rounded-md sm:h-[400px] md:h-[600px]">
              <Image
                src="/landing/illustrations/hero-illustration.png"
                alt={t("illustrationAlt")}
                fill
                sizes="(max-width: 768px) 100vw, 1024px"
                className="object-cover opacity-95"
                data-testid="landing-hero-illustration"
              />
            </div>
          </div>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-1/3 bg-gradient-to-t from-navy-base to-transparent"
          />
        </div>
      </div>
    </section>
  );
}

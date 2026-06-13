import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

interface Props {
  locale: string;
}

/**
 * BL-114-F001 (redo) — Hero on the Stitch "Neural Velocity" prototype.
 * BL-115-F002 — repositioned to the game-KOL "email collaboration hub"
 * (title/subtitle pivot to deliverability / compliance / open-rate pain
 * points) + a 4-item email data bar.
 *
 * Data-bar truthfulness (spec §1): `templates` uses the doc figure (1000+;
 * real count 27 tracked as a build-out follow-up, user-decided); `compliance`
 * lists the protocols, not a "one-click config tool"; `tracking` shows only
 * open/delivery rate — NO reply rate (repliedAt is never written, so a trial
 * would expose empty data); `reputation` is the honest 98% figure (not a
 * "guarantee"). No fabricated "+300% open rate" outcome claim.
 */
const HERO_STATS: ReadonlyArray<{
  key: "templates" | "compliance" | "tracking" | "reputation";
  // Universal values (number/protocols) are constants; `tracking` is
  // localized via i18n (stats.tracking.value).
  value?: string;
}> = [
  { key: "templates", value: "1000+" },
  { key: "compliance", value: "DKIM · SPF · DMARC" },
  { key: "tracking" },
  { key: "reputation", value: "98%" },
];

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
          <span className="font-landing-mono text-[11px] uppercase tracking-[0.2em] text-cyan-fixed-dim">
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

        {/* BL-115-F002 — email-collaboration data bar (4 highlights). See the
            component docstring for the per-item truthfulness handling. */}
        <dl
          data-testid="landing-hero-stats"
          className="mx-auto mt-14 grid max-w-3xl grid-cols-2 gap-x-6 gap-y-8 border-t border-outline-variant/10 pt-10 sm:gap-x-10 md:max-w-4xl md:grid-cols-4"
        >
          {HERO_STATS.map(({ key, value }) => (
            <div key={key} data-testid={`landing-hero-stat-${key}`} className="text-center">
              <dt className="gradient-text text-xl font-extrabold leading-tight md:text-2xl">
                {value ?? t(`stats.${key}.value`)}
              </dt>
              <dd className="mt-2 text-xs uppercase tracking-wide text-on-surface-variant">
                {t(`stats.${key}.label`)}
              </dd>
            </div>
          ))}
        </dl>

        {/* Dashboard preview — kept hero-illustration.png, glass-framed with a
            bottom fade into the page background (照原型 dashboard preview). */}
        <div className="relative mx-auto mt-16 max-w-5xl md:mt-24">
          <div className="rounded-lg bg-surface-low p-3 shadow-2xl shadow-cyan/10 md:p-4">
            <div className="relative h-[240px] w-full overflow-hidden rounded-md sm:h-[400px] md:h-[600px]">
              <Image
                src="/landing/illustrations/hero-illustration.png"
                alt={t("illustrationAlt")}
                fill
                priority
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

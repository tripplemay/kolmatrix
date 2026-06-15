import Image from "next/image";
import { getTranslations } from "next-intl/server";

import { PRD_DOC_URL } from "./landing-links";
import { TrialLeadCta } from "./TrialLeadCta";

/**
 * BL-114-F001 (redo) — Hero on the Stitch "Neural Velocity" prototype.
 * BL-115-F001 — primary CTA opens the trial modal; secondary is the PRD link.
 * BL-117-F001 — repositioned BACK to the broad "global game KOL marketing"
 * platform (BL-115 over-rotated to an email hub). Title/subtitle now span the
 * full lifecycle (discover → AI match → reach → measure); the data bar covers
 * the broad capability set with email kept as one item (not all four).
 *
 * Data-bar truthfulness (spec §1, carried from BL-115): all values are real —
 * 6,000+ KOL pool, AI semantic matching, the 4-module end-to-end loop, and the
 * platform's DKIM/SPF/DMARC sending compliance. No reply-rate claim (repliedAt
 * is never written), no fabricated outcome figures.
 */
const HERO_STATS: ReadonlyArray<{
  key: "kols" | "match" | "lifecycle" | "compliance";
  // Universal values (number / protocols) are constants; `match` + `lifecycle`
  // are localized via i18n (stats.<key>.value).
  value?: string;
}> = [
  { key: "kols", value: "6,000+" },
  { key: "match" },
  { key: "lifecycle" },
  { key: "compliance", value: "DKIM · SPF · DMARC" },
];

export async function HeroVideo() {
  const t = await getTranslations("landing.hero");

  return (
    <section
      data-testid="landing-hero"
      data-analytics-section="hero"
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
          {/* BL-115-F001 — primary CTA opens the in-page 3-field trial modal. */}
          <TrialLeadCta
            ctaId="hero"
            label={t("ctaPrimary")}
            className="landing-cta-primary inline-flex w-full items-center justify-center rounded-md px-8 py-4 text-base font-bold sm:w-auto"
          />
          {/* Secondary CTA → full PRD doc (external; ⚠️ confirm link before prod). */}
          <a
            href={PRD_DOC_URL}
            target="_blank"
            rel="noopener noreferrer"
            data-analytics-cta="prd-hero"
            data-testid="landing-cta-prd"
            className="inline-flex w-full items-center justify-center rounded-md bg-surface-high px-8 py-4 text-base font-bold text-white transition-colors duration-[var(--duration-landing-short)] hover:bg-surface-highest sm:w-auto"
          >
            {t("ctaSecondary")}
          </a>
        </div>

        {/* BL-117-F001 — broad capability data bar (KOL pool / AI match /
            end-to-end loop / email compliance). See docstring for truthfulness. */}
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

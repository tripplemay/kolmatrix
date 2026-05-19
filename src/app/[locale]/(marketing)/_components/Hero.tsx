import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

interface Props {
  locale: string;
}

// T14 replaces this with a real count read from the DB.
const KOL_COUNT_DISPLAY = 2500;

export async function Hero({ locale }: Props) {
  const t = await getTranslations("landing.hero");

  return (
    <section
      data-testid="landing-hero"
      className="relative overflow-hidden bg-surface px-6 py-20 lg:px-12 lg:py-28"
    >
      {/* ambient glow */}
      <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-cyan/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-32 bottom-0 h-96 w-96 rounded-full bg-secondary/10 blur-3xl" />

      <div className="relative mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1.2fr_1fr] lg:items-center">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-fixed">
            {t("kicker")}
          </div>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-white lg:text-5xl xl:text-6xl">
            {t("title")}
          </h1>
          <p className="mt-6 max-w-xl text-base text-on-surface-variant lg:text-lg">
            {t("subtitle")}
          </p>

          {/* 4-KPI strip */}
          <ul className="mt-8 grid grid-cols-2 gap-3">
            <li className="rounded-xl border border-cyan/20 bg-cyan/5 px-4 py-3 text-sm text-on-surface">
              <span aria-hidden="true" className="mr-2">🎮</span>
              {t("kpis.kolLibrary", { count: KOL_COUNT_DISPLAY })}
            </li>
            <li className="rounded-xl border border-cyan/20 bg-cyan/5 px-4 py-3 text-sm text-on-surface">
              <span aria-hidden="true" className="mr-2">🌐</span>
              <span className="font-semibold">{t("kpis.platforms")}</span>
              <div className="mt-1 text-xs text-on-surface-variant">{t("kpis.platformsHint")}</div>
            </li>
            <li className="rounded-xl border border-secondary/30 bg-secondary/10 px-4 py-3 text-sm text-on-surface">
              <span aria-hidden="true" className="mr-2">🤖</span>
              <span className="font-semibold text-secondary">{t("kpis.aiMatch")}</span>
              <div className="mt-1 text-xs text-on-surface-variant">{t("kpis.aiMatchHint")}</div>
            </li>
            <li className="rounded-xl border border-cyan/30 bg-cyan/10 px-4 py-3 text-sm text-on-surface">
              <span aria-hidden="true" className="mr-2">✉️</span>
              {t("kpis.compliance")}
            </li>
          </ul>

          {/* dual CTA */}
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={`/${locale}/request-access`}
              className="inline-flex items-center gap-2 rounded-full bg-cyan px-6 py-3 text-sm font-semibold text-surface shadow-[0_0_20px_rgba(0,229,255,0.4)] transition hover:bg-cyan/90"
              data-testid="landing-cta-primary"
            >
              {t("ctaPrimary")} →
            </Link>
            <Link
              href={`/${locale}/request-access?demo=1`}
              className="inline-flex items-center gap-2 rounded-full border border-cyan/40 px-6 py-3 text-sm font-semibold text-cyan transition hover:bg-cyan/10"
              data-testid="landing-cta-secondary"
            >
              {t("ctaSecondary")}
            </Link>
          </div>
        </div>

        {/* screenshot stack (right column, hidden on mobile) */}
        <div className="hidden flex-col gap-3 lg:flex">
          <div className="overflow-hidden rounded-2xl border border-cyan/20 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
            <Image
              src="/landing/screenshots/match-ai-sidebar.png"
              alt={t("screenshotAiAlt")}
              width={640}
              height={420}
              priority
              className="h-auto w-full"
            />
          </div>
          <div className="overflow-hidden rounded-2xl border border-cyan/20 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
            <Image
              src="/landing/screenshots/reach-domain-health.png"
              alt={t("screenshotReachAlt")}
              width={640}
              height={420}
              className="h-auto w-full"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

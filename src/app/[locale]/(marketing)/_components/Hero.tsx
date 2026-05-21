import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

interface Props {
  locale: string;
}

interface KpiMeta {
  key: "categories" | "platforms" | "aiMatch" | "compliance";
  icon: string;
  accent: "cyan" | "secondary";
}

const KPIS: ReadonlyArray<KpiMeta> = [
  { key: "categories", icon: "category", accent: "cyan" },
  { key: "platforms", icon: "public", accent: "cyan" },
  { key: "aiMatch", icon: "auto_awesome", accent: "secondary" },
  { key: "compliance", icon: "mark_email_read", accent: "cyan" },
];

export async function Hero({ locale }: Props) {
  const t = await getTranslations("landing.hero");

  return (
    <section
      data-testid="landing-hero"
      className="relative overflow-hidden bg-surface px-6 py-20 lg:px-12 lg:py-28"
    >
      {/* grain noise overlay (modern tech vibe — Vercel/Linear pattern) */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.035] mix-blend-overlay"
      >
        <filter id="landing-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#landing-grain)" />
      </svg>

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
            {KPIS.map(({ key, icon, accent }) => (
              <li
                key={key}
                className={
                  accent === "secondary"
                    ? "rounded-xl border border-secondary/30 bg-secondary/10 px-4 py-3 text-sm text-on-surface"
                    : "rounded-xl border border-cyan/20 bg-cyan/5 px-4 py-3 text-sm text-on-surface"
                }
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`material-symbols-outlined text-[18px] ${
                      accent === "secondary" ? "text-secondary" : "text-cyan"
                    }`}
                    aria-hidden="true"
                  >
                    {icon}
                  </span>
                  <span
                    className={`font-semibold ${
                      accent === "secondary" ? "text-secondary" : ""
                    }`}
                  >
                    {t(`kpis.${key}.title`)}
                  </span>
                </div>
                <div className="mt-1 text-xs text-on-surface-variant">
                  {t(`kpis.${key}.hint`)}
                </div>
              </li>
            ))}
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
          <div className="overflow-hidden rounded-2xl border border-cyan/20 shadow-[0_8px_32px_rgba(0,0,0,0.4)] transition hover:border-cyan/40 hover:shadow-[0_8px_32px_rgba(0,229,255,0.2)]">
            <Image
              src="/landing/screenshots/match-ai-sidebar.png"
              alt={t("screenshotAiAlt")}
              width={640}
              height={420}
              priority
              className="h-auto w-full"
            />
          </div>
          <div className="overflow-hidden rounded-2xl border border-cyan/20 shadow-[0_8px_32px_rgba(0,0,0,0.4)] transition hover:border-cyan/40 hover:shadow-[0_8px_32px_rgba(0,229,255,0.2)]">
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

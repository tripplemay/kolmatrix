import Link from "next/link";
import { getTranslations } from "next-intl/server";

interface Props {
  locale: string;
}

export async function FooterCTA({ locale }: Props) {
  const t = await getTranslations("landing.footerCta");

  return (
    <section
      data-testid="landing-footer-cta"
      className="relative overflow-hidden bg-surface px-6 py-24 lg:px-12"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan/40 to-transparent" />
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-2xl font-bold tracking-tight text-white lg:text-3xl">
          {t("sectionTitle")}
        </h2>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href={`/${locale}/request-access`}
            className="inline-flex items-center gap-2 rounded-full bg-cyan px-8 py-3 text-sm font-semibold text-surface shadow-[0_0_20px_rgba(0,229,255,0.4)] transition hover:bg-cyan/90"
            data-testid="landing-footer-cta-primary"
          >
            {t("ctaPrimary")} →
          </Link>
          <Link
            href={`/${locale}/request-access?demo=1`}
            className="inline-flex items-center gap-2 rounded-full border border-cyan/40 px-8 py-3 text-sm font-semibold text-cyan transition hover:bg-cyan/10"
            data-testid="landing-footer-cta-secondary"
          >
            {t("ctaSecondary")}
          </Link>
        </div>
        <div className="mt-16 text-xs text-on-surface-variant">
          <p>{t("footerLine")}</p>
        </div>
      </div>
    </section>
  );
}

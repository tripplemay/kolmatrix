import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ScrollFadeIn } from "@/components/landing/ScrollFadeIn";

interface Props {
  locale: string;
}

export async function FooterCTA({ locale }: Props) {
  const t = await getTranslations("landing.footerCta");

  return (
    <section
      data-testid="landing-footer-cta"
      className="relative overflow-hidden bg-surface text-on-surface px-6 py-32 lg:px-12"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan/40 to-transparent" />
      <ScrollFadeIn>
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="cinematic-text font-geist text-4xl lg:text-6xl font-extrabold tracking-tight leading-tight">
            {t("sectionTitle")}
          </h2>
          <div className="mt-12 flex flex-wrap justify-center gap-3">
            <Link
              href={`/${locale}/request-access`}
              className="cta-glow-pulse inline-flex items-center gap-2 rounded-full bg-cyan px-10 py-4 text-base font-semibold text-surface shadow-[0_0_24px_var(--glow-cyan)] hover:bg-cyan/90 transition"
              data-testid="landing-footer-cta-primary"
            >
              {t("ctaPrimary")} →
            </Link>
            <Link
              href={`/${locale}/request-access?demo=1`}
              className="inline-flex items-center gap-2 rounded-full border border-cyan/40 px-10 py-4 text-base font-semibold text-cyan hover:bg-cyan/10 transition"
              data-testid="landing-footer-cta-secondary"
            >
              {t("ctaSecondary")}
            </Link>
          </div>
          <div className="mt-20 font-geist-mono text-[11px] text-on-surface-variant/70 uppercase tracking-[0.2em]">
            <p>{t("footerLine")}</p>
          </div>
        </div>
      </ScrollFadeIn>
    </section>
  );
}

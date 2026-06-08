import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { StickyStack } from "@/components/landing/StickyStack";
import { ScrollFadeIn } from "@/components/landing/ScrollFadeIn";
import { resolveLandingAsset } from "./illustration-asset";

interface FeatureMeta {
  key: "library" | "aiMatch" | "insight" | "reach" | "crm" | "roi";
  href: string;
  /**
   * BL-080-F003 illustration (preferred). null = no illustration generated
   * for this card → always use the real screenshot. The 5 feature-* PNGs
   * map per docs/specs/BL-080-illustration-prompts.md (#2–#6):
   *   library → feature-match (filter sidebar + KOL grid)
   *   aiMatch → feature-brief (NL brief → AI parsing)
   *   insight/reach/crm → feature-{insight,reach,crm}
   * roi has no illustration and falls back to roi-full.png.
   */
  illustration: string | null;
  screenshot: string;
  /** Intrinsic dimensions of the resolved asset (CLS reservation). */
  width: number;
  height: number;
}

const FEATURES: ReadonlyArray<FeatureMeta> = [
  { key: "library", href: "/match", illustration: "/landing/illustrations/feature-match.png", screenshot: "/landing/screenshots/match-full.png", width: 1200, height: 896 },
  { key: "aiMatch", href: "/match", illustration: "/landing/illustrations/feature-brief.png", screenshot: "/landing/screenshots/match-ai-sidebar.png", width: 1200, height: 896 },
  { key: "insight", href: "/insight", illustration: "/landing/illustrations/feature-insight.png", screenshot: "/landing/screenshots/insight-full.png", width: 1200, height: 896 },
  { key: "reach", href: "/reach", illustration: "/landing/illustrations/feature-reach.png", screenshot: "/landing/screenshots/reach-domain-health.png", width: 1200, height: 896 },
  { key: "crm", href: "/crm", illustration: "/landing/illustrations/feature-crm.png", screenshot: "/landing/screenshots/crm-full.png", width: 1200, height: 896 },
  { key: "roi", href: "/roi", illustration: null, screenshot: "/landing/screenshots/roi-full.png", width: 1440, height: 900 },
];

interface Props {
  locale: string;
}

export async function Features({ locale }: Props) {
  const t = await getTranslations("landing.features");

  return (
    <StickyStack
      sectionTestId="landing-features"
      bgClassName="bg-surface-light"
      textClassName="text-on-surface-light"
      leftContent={
        <>
          <div className="font-geist-mono text-landing-eyebrow tracking-landing-eyebrow text-landing-cyan-deep uppercase">
            {t("intro.label")}
          </div>
          <h2 className="mt-4 font-geist text-landing-h2 font-bold leading-landing-tight tracking-landing-tight whitespace-pre-line">
            {t("intro.title")}
          </h2>
          <p className="mt-5 text-landing-body-lg leading-landing-relaxed text-on-surface-light-variant max-w-md">
            {t("intro.subtitle")}
          </p>
        </>
      }
    >
      {FEATURES.map(({ key, href, illustration, screenshot, width, height }, idx) => (
        <ScrollFadeIn key={key} delayMs={idx * 80}>
          <a
            href={`/${locale}${href}`}
            data-testid={`landing-feature-${key}`}
            className="landing-card-light group flex flex-col gap-4 p-7"
          >
            <div className="flex items-baseline gap-3">
              <span className="font-geist-mono text-landing-eyebrow tracking-landing-eyebrow text-on-surface-light-muted">
                {String(idx + 1).padStart(2, "0")}
              </span>
              <h3 className="font-geist text-landing-h3 font-semibold leading-landing-tight tracking-landing-tight text-on-surface-light">
                {t(`items.${key}.title`)}
              </h3>
            </div>
            <p className="text-landing-body leading-landing-relaxed text-on-surface-light-variant">
              {t(`items.${key}.body`)}
            </p>
            <div className="mt-2 overflow-hidden rounded-xl border border-on-surface-light/8 transition-colors duration-[var(--duration-landing-short)] group-hover:border-cyan/35">
              <Image
                src={illustration ? resolveLandingAsset(illustration, screenshot) : screenshot}
                alt={t(`items.${key}.title`)}
                width={width}
                height={height}
                quality={80}
                sizes="(max-width: 1024px) 100vw, 580px"
                className="h-auto w-full opacity-95 transition-transform duration-[var(--duration-landing-medium)] ease-[var(--ease-landing-out)] motion-reduce:transform-none group-hover:scale-[1.02]"
              />
            </div>
          </a>
        </ScrollFadeIn>
      ))}
    </StickyStack>
  );
}

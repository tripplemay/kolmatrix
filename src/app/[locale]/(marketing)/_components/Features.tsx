import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { StickyStack } from "@/components/landing/StickyStack";
import { ScrollFadeIn } from "@/components/landing/ScrollFadeIn";

interface FeatureMeta {
  key: "library" | "aiMatch" | "insight" | "reach" | "crm" | "roi";
  href: string;
  screenshot: string;
}

const FEATURES: ReadonlyArray<FeatureMeta> = [
  { key: "library", href: "/match", screenshot: "/landing/screenshots/match-full.png" },
  { key: "aiMatch", href: "/match", screenshot: "/landing/screenshots/match-ai-sidebar.png" },
  { key: "insight", href: "/insight", screenshot: "/landing/screenshots/insight-full.png" },
  { key: "reach", href: "/reach", screenshot: "/landing/screenshots/reach-domain-health.png" },
  { key: "crm", href: "/crm", screenshot: "/landing/screenshots/crm-full.png" },
  { key: "roi", href: "/roi", screenshot: "/landing/screenshots/roi-full.png" },
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
          <div className="font-geist-mono text-landing-eyebrow tracking-landing-eyebrow text-cyan uppercase">
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
      {FEATURES.map(({ key, href, screenshot }, idx) => (
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
                src={screenshot}
                alt={t(`items.${key}.title`)}
                width={640}
                height={400}
                className="h-auto w-full opacity-95 transition-transform duration-[var(--duration-landing-medium)] ease-[var(--ease-landing-out)] motion-reduce:transform-none group-hover:scale-[1.02]"
              />
            </div>
          </a>
        </ScrollFadeIn>
      ))}
    </StickyStack>
  );
}

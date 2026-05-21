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
          <div className="font-geist-mono text-[11px] tracking-[0.3em] text-cyan uppercase">
            {t("intro.label")}
          </div>
          <h2 className="mt-4 font-geist text-4xl lg:text-5xl font-bold tracking-tight whitespace-pre-line">
            {t("intro.title")}
          </h2>
          <p className="mt-5 text-base text-on-surface-light-variant max-w-md leading-relaxed">
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
            className="group flex flex-col gap-4 rounded-2xl border border-on-surface-light/10 bg-surface-light-container p-7 transition duration-200 hover:-translate-y-1 hover:border-cyan/60 hover:shadow-[0_12px_32px_rgba(0,229,255,0.18)]"
          >
            <div className="flex items-baseline gap-3">
              <span className="font-geist-mono text-[11px] tracking-[0.2em] text-on-surface-light-muted">
                {String(idx + 1).padStart(2, "0")}
              </span>
              <h3 className="font-geist text-lg font-semibold text-on-surface-light">
                {t(`items.${key}.title`)}
              </h3>
            </div>
            <p className="text-sm text-on-surface-light-variant leading-relaxed">
              {t(`items.${key}.body`)}
            </p>
            <div className="mt-2 overflow-hidden rounded-xl border border-on-surface-light/8 transition group-hover:border-cyan/30">
              <Image
                src={screenshot}
                alt={t(`items.${key}.title`)}
                width={640}
                height={400}
                className="h-auto w-full opacity-95 transition duration-200 group-hover:scale-[1.02]"
              />
            </div>
          </a>
        </ScrollFadeIn>
      ))}
    </StickyStack>
  );
}

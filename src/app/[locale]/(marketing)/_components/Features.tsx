import Image from "next/image";
import { getTranslations } from "next-intl/server";

interface Props {
  locale: string;
}

interface FeatureMeta {
  key: "library" | "aiMatch" | "insight" | "reach" | "crm" | "roi";
  href: string;
  screenshot: string;
  accent: "cyan" | "secondary" | "cyanStrong";
}

const FEATURES: ReadonlyArray<FeatureMeta> = [
  { key: "library", href: "/match", screenshot: "/landing/screenshots/match-full.png", accent: "cyan" },
  { key: "aiMatch", href: "/match", screenshot: "/landing/screenshots/match-ai-sidebar.png", accent: "secondary" },
  { key: "insight", href: "/insight", screenshot: "/landing/screenshots/insight-full.png", accent: "cyan" },
  { key: "reach", href: "/reach", screenshot: "/landing/screenshots/reach-domain-health.png", accent: "cyanStrong" },
  { key: "crm", href: "/crm", screenshot: "/landing/screenshots/crm-full.png", accent: "cyan" },
  { key: "roi", href: "/roi", screenshot: "/landing/screenshots/roi-full.png", accent: "cyan" },
];

function accentClass(accent: FeatureMeta["accent"]): string {
  if (accent === "secondary") return "border-secondary/30 bg-secondary/5";
  if (accent === "cyanStrong") return "border-cyan/40 bg-cyan/10";
  return "border-cyan/15 bg-surface-container";
}

function titleColorClass(accent: FeatureMeta["accent"]): string {
  if (accent === "secondary") return "text-secondary";
  return "text-cyan";
}

export async function Features({ locale }: Props) {
  const t = await getTranslations("landing.features");

  return (
    <section
      data-testid="landing-features"
      className="bg-surface px-6 py-24 lg:px-12"
    >
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center text-2xl font-bold tracking-tight text-white lg:text-3xl">
          {t("sectionTitle")}
        </h2>
        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ key, href, screenshot, accent }) => (
            <a
              key={key}
              href={`/${locale}${href}`}
              data-testid={`landing-feature-${key}`}
              className={`group flex flex-col gap-4 rounded-2xl border p-6 transition duration-200 hover:-translate-y-1 hover:border-cyan/60 hover:shadow-[0_12px_32px_rgba(0,229,255,0.18)] ${accentClass(accent)}`}
            >
              <h3 className={`text-base font-semibold ${titleColorClass(accent)}`}>
                {t(`items.${key}.title`)}
              </h3>
              <p className="text-sm text-on-surface-variant">
                {t(`items.${key}.body`)}
              </p>
              <div className="mt-auto overflow-hidden rounded-xl border border-cyan/10 transition group-hover:border-cyan/30">
                <Image
                  src={screenshot}
                  alt={t(`items.${key}.title`)}
                  width={480}
                  height={300}
                  className="h-auto w-full opacity-90 transition duration-200 group-hover:scale-[1.02] group-hover:opacity-100"
                />
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

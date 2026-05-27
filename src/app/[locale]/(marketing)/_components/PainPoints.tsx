import { getTranslations } from "next-intl/server";
import { ScrollFadeIn } from "@/components/landing/ScrollFadeIn";

interface PainItem {
  key: "find" | "match" | "email" | "workflow";
  icon: string;
}

const ITEMS: ReadonlyArray<PainItem> = [
  { key: "find", icon: "search" },
  { key: "match", icon: "track_changes" },
  { key: "email", icon: "unsubscribe" },
  { key: "workflow", icon: "settings" },
];

export async function PainPoints() {
  const t = await getTranslations("landing.painPoints");

  return (
    <section
      data-testid="landing-painpoints"
      className="bg-surface-light text-on-surface-light px-6 lg:px-12"
      style={{ paddingTop: "var(--spacing-landing-section-y)", paddingBottom: "var(--spacing-landing-section-y)" }}
    >
      <div className="mx-auto max-w-6xl">
        <ScrollFadeIn>
          <h2 className="font-geist text-center text-landing-h2 font-bold leading-landing-tight tracking-landing-tight text-on-surface-light">
            {t("sectionTitle")}
          </h2>
        </ScrollFadeIn>

        <div className="mt-16 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {ITEMS.map(({ key, icon }, idx) => (
            <ScrollFadeIn key={key} delayMs={idx * 120}>
              <div
                data-testid={`landing-painpoint-${key}`}
                className="landing-card-light p-7 h-full"
              >
                <span className="landing-icon-halo">
                  <span
                    className="material-symbols-outlined text-[24px]"
                    aria-hidden="true"
                  >
                    {icon}
                  </span>
                </span>
                <h3 className="mt-5 font-geist text-landing-h3 font-semibold leading-landing-tight tracking-landing-tight text-on-surface-light">
                  {t(`items.${key}.title`)}
                </h3>
                <p className="mt-3 text-landing-body leading-landing-relaxed text-on-surface-light-variant">
                  {t(`items.${key}.body`)}
                </p>
              </div>
            </ScrollFadeIn>
          ))}
        </div>

        <ScrollFadeIn delayMs={600}>
          <p className="mt-16 text-center text-landing-body-lg leading-landing-relaxed font-geist text-on-surface-light-variant">
            {t("tagline")}
          </p>
        </ScrollFadeIn>
      </div>
    </section>
  );
}

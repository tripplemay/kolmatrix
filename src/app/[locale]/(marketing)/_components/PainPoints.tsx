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
      className="bg-surface-light text-on-surface-light px-6 py-32 lg:px-12"
    >
      <div className="mx-auto max-w-6xl">
        <ScrollFadeIn>
          <h2 className="font-geist text-center text-3xl font-bold tracking-tight text-on-surface-light lg:text-4xl">
            {t("sectionTitle")}
          </h2>
        </ScrollFadeIn>

        <div className="mt-16 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {ITEMS.map(({ key, icon }, idx) => (
            <ScrollFadeIn key={key} delayMs={idx * 120}>
              <div
                data-testid={`landing-painpoint-${key}`}
                className="rounded-2xl bg-surface-light-container border border-on-surface-light/8 p-7 h-full transition hover:border-cyan/40 hover:shadow-[0_8px_28px_rgba(0,229,255,0.15)]"
              >
                <span
                  className="material-symbols-outlined text-[28px] text-cyan"
                  aria-hidden="true"
                >
                  {icon}
                </span>
                <h3 className="mt-4 font-geist text-base font-semibold text-on-surface-light">
                  {t(`items.${key}.title`)}
                </h3>
                <p className="mt-2 text-sm text-on-surface-light-variant leading-relaxed">
                  {t(`items.${key}.body`)}
                </p>
              </div>
            </ScrollFadeIn>
          ))}
        </div>

        <ScrollFadeIn delayMs={600}>
          <p className="mt-16 text-center text-base font-geist text-on-surface-light-variant">
            {t("tagline")}
          </p>
        </ScrollFadeIn>
      </div>
    </section>
  );
}

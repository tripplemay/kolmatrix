import { getTranslations } from "next-intl/server";

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
      className="bg-surface-container-lowest px-6 py-20 lg:px-12"
    >
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center text-2xl font-bold tracking-tight text-white lg:text-3xl">
          {t("sectionTitle")}
        </h2>
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ITEMS.map(({ key, icon }) => (
            <div
              key={key}
              data-testid={`landing-painpoint-${key}`}
              className="rounded-2xl bg-surface-container p-6 transition hover:bg-surface-container/80"
            >
              <span
                className="material-symbols-outlined text-[24px] text-cyan"
                aria-hidden="true"
              >
                {icon}
              </span>
              <h3 className="mt-3 text-sm font-semibold text-white">
                {t(`items.${key}.title`)}
              </h3>
              <p className="mt-2 text-xs text-on-surface-variant">
                {t(`items.${key}.body`)}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-10 text-center text-sm text-primary-fixed">
          {t("tagline")}
        </p>
      </div>
    </section>
  );
}

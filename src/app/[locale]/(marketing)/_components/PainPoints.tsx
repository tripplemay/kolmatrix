import { getTranslations } from "next-intl/server";

export async function PainPoints() {
  const t = await getTranslations("landing.painPoints");
  const items = ["find", "match", "email", "workflow"] as const;

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
          {items.map((key) => (
            <div
              key={key}
              data-testid={`landing-painpoint-${key}`}
              className="rounded-2xl bg-surface-container p-6"
            >
              <div className="text-2xl" aria-hidden="true">
                {t(`items.${key}.icon`)}
              </div>
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

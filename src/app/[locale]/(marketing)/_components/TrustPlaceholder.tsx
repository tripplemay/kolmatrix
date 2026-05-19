import { getTranslations } from "next-intl/server";

export async function TrustPlaceholder() {
  const t = await getTranslations("landing.trust");
  const items = ["encryption", "email", "partners"] as const;

  return (
    <section
      data-testid="landing-trust"
      className="bg-surface px-6 py-24 lg:px-12"
    >
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center text-2xl font-bold tracking-tight text-white lg:text-3xl">
          {t("sectionTitle")}
        </h2>
        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          {items.map((key) => (
            <div
              key={key}
              data-testid={`landing-trust-${key}`}
              className="flex flex-col items-center rounded-2xl border border-cyan/15 bg-surface-container p-8 text-center"
            >
              <div className="text-3xl" aria-hidden="true">
                {t(`items.${key}.icon`)}
              </div>
              <h3 className="mt-4 text-base font-semibold text-white">
                {t(`items.${key}.title`)}
              </h3>
              <p className="mt-3 text-sm text-on-surface-variant">
                {t(`items.${key}.body`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

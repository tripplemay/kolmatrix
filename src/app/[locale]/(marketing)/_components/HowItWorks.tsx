import { getTranslations } from "next-intl/server";

/**
 * BL-114-F003 — "How it works" section, built to the Stitch "Neural Velocity"
 * prototype: a heading + 3 mono-numbered phases (01 / 02 / 03). Rendered on
 * the deepest surface (surface-lowest) for a subtle tonal band between the
 * navy-base sections around it.
 */
const STEPS = ["s1", "s2", "s3"] as const;

export async function HowItWorks() {
  const t = await getTranslations("landing.howItWorks");

  return (
    <section
      data-testid="landing-how-it-works"
      className="overflow-hidden bg-surface-lowest px-6 py-24 lg:px-8 lg:py-32"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-16 flex flex-col items-end justify-between gap-8 md:mb-24 md:flex-row">
          <div className="max-w-xl">
            <h2 className="text-4xl font-extrabold tracking-tight text-white md:text-5xl">
              {t("title")}
            </h2>
            <p className="mt-6 text-lg text-on-surface-variant">{t("subtitle")}</p>
          </div>
          <div
            aria-hidden
            className="mx-12 mb-6 hidden h-px flex-1 bg-outline-variant/10 md:block"
          />
        </div>
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-3">
          {STEPS.map((s, idx) => (
            <div key={s} data-testid={`landing-step-${idx + 1}`}>
              <span className="mb-8 block font-landing-mono text-4xl font-bold text-cyan-fixed-dim">
                {String(idx + 1).padStart(2, "0")}
              </span>
              <h3 className="mb-4 text-2xl font-bold text-white">{t(`steps.${s}.title`)}</h3>
              <p className="leading-relaxed text-on-surface-variant">{t(`steps.${s}.body`)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

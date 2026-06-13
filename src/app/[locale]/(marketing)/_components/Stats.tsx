import { getTranslations } from "next-intl/server";

/**
 * BL-114-F003 — Stats band, built to the Stitch "Neural Velocity" prototype:
 * 3 large gradient figures + muted uppercase captions. Figures are display
 * constants (not translated); the captions are localized.
 */
interface Stat {
  key: "kols" | "languages" | "roi";
  value: string;
}

const STATS: ReadonlyArray<Stat> = [
  { key: "kols", value: "6,000+" },
  { key: "languages", value: "5+" },
  { key: "roi", value: "100%" },
];

export async function Stats() {
  const t = await getTranslations("landing.stats");

  return (
    <section
      data-testid="landing-stats"
      data-analytics-section="stats"
      className="bg-navy-base px-6 py-24 lg:px-8 lg:py-32"
    >
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 text-center md:grid-cols-3 md:text-left">
        {STATS.map(({ key, value }) => (
          <div key={key} data-testid={`landing-stat-${key}`}>
            <p className="gradient-text mb-4 text-5xl font-extrabold md:text-7xl">{value}</p>
            <p className="text-sm font-medium uppercase tracking-wide text-on-surface-variant">
              {t(`items.${key}.label`)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

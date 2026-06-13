import { getTranslations } from "next-intl/server";

/**
 * BL-114-F002 — Core Capabilities bento, rebuilt to the Stitch "Neural
 * Velocity" prototype: 4 tonal-layered cards (Brief / Match / Reach /
 * Insight), each a cyan icon tile + mono cyan label + bold title + muted
 * description. No borders (surface layering), cyan glow + lift on hover.
 * The 5 BL-080 feature illustrations / light StickyStack layout are dropped.
 */
interface BentoCard {
  key: "brief" | "match" | "reach" | "insight";
  icon: string;
}

// Icons per spec F002 (auto_awesome / travel_explore / forward_to_inbox /
// query_stats). Reach uses forward_to_inbox — the canonical Email Center
// glyph + the product's actual Reach = email-outreach semantics — rather
// than the prototype's generic rocket_launch. All four live in the
// self-hosted Material Symbols subset (query_stats added in this batch).
const CARDS: ReadonlyArray<BentoCard> = [
  { key: "brief", icon: "auto_awesome" },
  { key: "match", icon: "travel_explore" },
  { key: "reach", icon: "forward_to_inbox" },
  { key: "insight", icon: "query_stats" },
];

export async function Features() {
  const t = await getTranslations("landing.features");

  return (
    <section
      data-testid="landing-features"
      data-analytics-section="features"
      className="bg-navy-base px-6 py-24 lg:px-8 lg:py-32"
    >
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {CARDS.map(({ key, icon }) => (
          <div
            key={key}
            data-testid={`landing-feature-${key}`}
            className="landing-bento-card group flex min-h-[300px] flex-col justify-between p-8"
          >
            <div>
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-md bg-cyan-fixed-dim/10 text-cyan-fixed-dim transition-transform duration-[var(--duration-landing-short)] group-hover:scale-110 motion-reduce:transform-none">
                <span className="material-symbols-outlined text-[24px]" aria-hidden="true">
                  {icon}
                </span>
              </div>
              <h3 className="mb-4 font-landing-mono text-sm uppercase tracking-widest text-cyan-fixed-dim">
                {t(`items.${key}.label`)}
              </h3>
              <p className="text-xl font-bold leading-tight text-white">
                {t(`items.${key}.title`)}
              </p>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-on-surface-variant">
              {t(`items.${key}.body`)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

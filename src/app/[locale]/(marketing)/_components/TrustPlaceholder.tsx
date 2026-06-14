import { getTranslations } from "next-intl/server";

/**
 * BL-115-F004 — trust framework (replaces the BL-114/F002 fake "Trusted by"
 * studio wordmarks, which carried false-endorsement + trademark risk).
 * Honest framing per spec §1:
 *  - game coverage shown as generic genre verticals (NOT real game-IP names),
 *  - security/compliance badges list only capabilities we actually have,
 *  - customer testimonials are a clearly-marked placeholder (pending real,
 *    authorized quotes).
 */
const VERTICALS = ["RPG", "FPS", "MOBA", "SLG", "MMO", "Casual", "Card", "Sandbox"] as const;

interface Badge {
  key: "encryption" | "isolation" | "compliance" | "ai";
  icon: string;
}
const BADGES: ReadonlyArray<Badge> = [
  { key: "encryption", icon: "verified_user" },
  { key: "isolation", icon: "hub" },
  { key: "compliance", icon: "forward_to_inbox" },
  { key: "ai", icon: "bolt" },
];

export async function TrustPlaceholder() {
  const t = await getTranslations("landing.trust");

  return (
    <section
      data-testid="landing-trust"
      data-analytics-section="trust"
      className="border-y border-outline-variant/5 bg-navy-base px-6 py-20 lg:px-8"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-extrabold tracking-tight text-white md:text-3xl">
            {t("title")}
          </h2>
          <p className="mt-3 text-on-surface-variant">{t("subtitle")}</p>
        </div>

        {/* Game-genre coverage (replaces fake customer logos). */}
        <p className="mt-12 text-center font-landing-mono text-[10px] uppercase tracking-[0.25em] text-on-surface-variant">
          {t("verticalsCaption")}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2.5">
          {VERTICALS.map((v) => (
            <span
              key={v}
              data-testid={`landing-vertical-${v}`}
              className="rounded-md bg-surface-low px-3.5 py-1.5 text-sm font-semibold text-on-surface"
            >
              {v}
            </span>
          ))}
        </div>

        {/* Real security / compliance badges. */}
        <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {BADGES.map(({ key, icon }) => (
            <div
              key={key}
              data-testid={`landing-badge-${key}`}
              className="flex items-center gap-3 rounded-lg bg-surface-low p-4"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-cyan-fixed-dim/10 text-cyan-fixed-dim">
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                  {icon}
                </span>
              </span>
              <span className="text-sm font-medium leading-tight text-white">{t(`badges.${key}`)}</span>
            </div>
          ))}
        </div>

        {/* Testimonial slot — honest placeholder until real quotes are authorized. */}
        <p
          data-testid="landing-testimonial-placeholder"
          className="mx-auto mt-12 max-w-xl rounded-lg border border-dashed border-outline-variant/30 px-6 py-5 text-center text-sm text-on-surface-variant"
        >
          {t("testimonialNote")}
        </p>
      </div>
    </section>
  );
}

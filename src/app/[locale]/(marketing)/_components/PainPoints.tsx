import { getTranslations } from "next-intl/server";

/**
 * BL-115-F003 — email pain-point section. BL-117-F002 — broadened from 4
 * all-email pains back to the 4 KOL-marketing pains the broad platform solves:
 * scattered cross-platform discovery, slow/imprecise filtering (AI match),
 * uncontrollable conversion (data review), and email deliverability/compliance
 * (the one email pain kept). Error-tinted icons read as "problem".
 */
interface Pain {
  key: "discovery" | "matching" | "conversion" | "compliance";
  icon: string;
}

const PAINS: ReadonlyArray<Pain> = [
  { key: "discovery", icon: "travel_explore" },
  { key: "matching", icon: "query_stats" },
  { key: "conversion", icon: "trending_down" },
  { key: "compliance", icon: "gpp_maybe" },
];

export async function PainPoints() {
  const t = await getTranslations("landing.painPoints");

  return (
    <section
      data-testid="landing-painpoints"
      data-analytics-section="painpoints"
      className="bg-surface-lowest px-6 py-24 lg:px-8 lg:py-32"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-white md:text-4xl">
            {t("title")}
          </h2>
          <p className="mt-4 text-lg text-on-surface-variant">{t("subtitle")}</p>
        </div>
        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {PAINS.map(({ key, icon }) => (
            <div
              key={key}
              data-testid={`landing-pain-${key}`}
              className="rounded-lg bg-surface-low p-8"
            >
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-md bg-error/10 text-error">
                <span className="material-symbols-outlined text-[24px]" aria-hidden="true">
                  {icon}
                </span>
              </div>
              <h3 className="text-lg font-bold leading-tight text-white">
                {t(`items.${key}.title`)}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">
                {t(`items.${key}.body`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

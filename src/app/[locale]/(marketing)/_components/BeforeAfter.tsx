import { getTranslations } from "next-intl/server";

interface Row {
  key: "discover" | "match" | "email" | "review";
  icon: string;
}

const ROWS: ReadonlyArray<Row> = [
  { key: "discover", icon: "search" },
  { key: "match", icon: "auto_awesome" },
  { key: "email", icon: "outgoing_mail" },
  { key: "review", icon: "insights" },
];

export async function BeforeAfter() {
  const t = await getTranslations("landing.beforeAfter");

  return (
    <section
      data-testid="landing-before-after"
      className="bg-surface px-6 py-24 lg:px-12"
    >
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-center gap-3 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-white lg:text-3xl">
            {t("sectionTitle")}
          </h2>
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-secondary/40 bg-secondary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-secondary"
            data-testid="landing-before-after-demo-badge"
          >
            <span
              className="material-symbols-outlined text-[14px]"
              aria-hidden="true"
            >
              science
            </span>
            {t("demoBadge")}
          </span>
        </div>

        <div className="mt-12 overflow-hidden rounded-2xl border border-cyan/15">
          {/* header */}
          <div className="hidden grid-cols-[1.4fr_1fr_1fr] gap-4 border-b border-cyan/15 bg-surface-container-lowest px-6 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant md:grid">
            <div>{t("colTask")}</div>
            <div className="text-on-surface-variant/60">{t("colBefore")}</div>
            <div className="text-cyan">{t("colAfter")}</div>
          </div>
          {/* rows */}
          {ROWS.map(({ key, icon }, idx) => (
            <div
              key={key}
              data-testid={`landing-before-after-${key}`}
              className={`grid grid-cols-1 gap-3 px-6 py-5 md:grid-cols-[1.4fr_1fr_1fr] md:gap-4 ${
                idx < ROWS.length - 1 ? "border-b border-cyan/10" : ""
              } ${idx % 2 === 0 ? "bg-surface" : "bg-surface-container"}`}
            >
              <div className="flex items-center gap-3 text-sm font-semibold text-white">
                <span
                  className="material-symbols-outlined text-[20px] text-cyan"
                  aria-hidden="true"
                >
                  {icon}
                </span>
                {t(`rows.${key}.task`)}
              </div>
              <div className="text-sm text-on-surface-variant/70 line-through decoration-on-surface-variant/40">
                <span className="md:hidden mr-2 not-italic no-underline text-xs uppercase tracking-wider text-on-surface-variant/50">
                  {t("colBefore")}:
                </span>
                {t(`rows.${key}.before`)}
              </div>
              <div className="text-sm font-medium text-cyan">
                <span className="md:hidden mr-2 not-italic text-xs uppercase tracking-wider text-on-surface-variant/50">
                  {t("colAfter")}:
                </span>
                {t(`rows.${key}.after`)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

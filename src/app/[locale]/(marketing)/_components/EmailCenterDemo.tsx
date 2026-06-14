import { getTranslations } from "next-intl/server";

/**
 * BL-115-F003 — email-center demo (re-added). A static, Neural Velocity
 * representation of the real reach UI: domain-health (DKIM/SPF/DMARC +
 * reputation 98, mirroring DomainHealthCard), a recent-sends list, and the
 * game-vertical template library, each with a feature annotation.
 *
 * Truthfulness (spec §1): domain health reflects the real (static) Resend
 * DKIM/SPF/DMARC + reputation 98 — worded as a status display, not a
 * "one-click config tool". Recent sends show delivery/open status only — NO
 * reply rate (repliedAt is never written). Sample rows are clearly demo data.
 */
const SEND_ROWS = [
  { handle: "@AuroraPlays", statusKey: "statusOpened" as const },
  { handle: "@NovaStream", statusKey: "statusDelivered" as const },
  { handle: "@PixelKnight", statusKey: "statusOpened" as const },
];

// Protocol names + game genres are universal tags → constants (not i18n).
const HEALTH_ROWS = [
  { label: "DKIM", valueKey: "configured" },
  { label: "SPF", valueKey: "validated" },
  { label: "DMARC", valueKey: "enforced" },
] as const;

const GENRES = ["RPG", "FPS", "MOBA", "Strategy", "Casual", "Card"] as const;

export async function EmailCenterDemo() {
  const t = await getTranslations("landing.demo");

  return (
    <section
      data-testid="landing-email-demo"
      data-analytics-section="email-demo"
      className="bg-navy-base px-6 py-24 lg:px-8 lg:py-32"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-white md:text-4xl">
            {t("title")}
          </h2>
          <p className="mt-4 text-lg text-on-surface-variant">{t("subtitle")}</p>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Panel 1 — domain health (mirrors DomainHealthCard). */}
          <div
            data-testid="landing-demo-health"
            className="flex flex-col rounded-lg bg-surface-low p-6"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">{t("health.title")}</h3>
              <span className="rounded-full bg-cyan/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-fixed">
                {t("health.status")}
              </span>
            </div>
            <ul className="mt-5 space-y-3">
              {HEALTH_ROWS.map(({ label, valueKey }) => (
                <li key={label} className="flex items-center justify-between text-sm">
                  <span className="text-on-surface-variant">{label}</span>
                  <span className="inline-flex items-center gap-1.5 font-medium text-cyan-fixed">
                    <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                      check_circle
                    </span>
                    {t(`health.${valueKey}`)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex items-baseline gap-2 border-t border-outline-variant/10 pt-5">
              <span className="gradient-text text-4xl font-extrabold">98</span>
              <span className="text-sm text-on-surface-variant">{t("health.reputation")}</span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-on-surface-variant">{t("health.note")}</p>
          </div>

          {/* Panel 2 — recent sends (delivery/open status only; no reply rate). */}
          <div
            data-testid="landing-demo-sends"
            className="flex flex-col rounded-lg bg-surface-low p-6"
          >
            <h3 className="text-sm font-bold text-white">{t("sends.title")}</h3>
            <ul className="mt-5 space-y-3">
              {SEND_ROWS.map(({ handle, statusKey }) => (
                <li key={handle} className="flex items-center justify-between text-sm">
                  <span className="inline-flex items-center gap-2 text-white">
                    <span className="material-symbols-outlined text-[18px] text-cyan-fixed-dim" aria-hidden="true">
                      forward_to_inbox
                    </span>
                    {handle}
                  </span>
                  <span className="rounded-full bg-cyan/10 px-2.5 py-0.5 text-[11px] font-medium text-cyan-fixed">
                    {t(`sends.${statusKey}`)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-xs leading-relaxed text-on-surface-variant">{t("sends.note")}</p>
          </div>

          {/* Panel 3 — game-vertical template library. */}
          <div
            data-testid="landing-demo-templates"
            className="flex flex-col rounded-lg bg-surface-low p-6"
          >
            <h3 className="text-sm font-bold text-white">{t("templates.title")}</h3>
            <div className="mt-5 flex flex-wrap gap-2">
              {GENRES.map((g) => (
                <span
                  key={g}
                  className="inline-flex items-center gap-1.5 rounded-md bg-surface-high px-3 py-1.5 text-xs font-medium text-on-surface"
                >
                  <span className="material-symbols-outlined text-[16px] text-cyan-fixed-dim" aria-hidden="true">
                    inventory_2
                  </span>
                  {g}
                </span>
              ))}
            </div>
            <p className="mt-6 text-xs leading-relaxed text-on-surface-variant">{t("templates.note")}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

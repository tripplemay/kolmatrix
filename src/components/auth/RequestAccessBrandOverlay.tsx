import { getTranslations } from "next-intl/server";

/**
 * Left-column cinematic overlay for /request-access. Mirrors
 * design-draft/stitch-references/signup.html: wordmark + headline +
 * 2x2 glass HUD chips + "Recently Joined" studio cards footer.
 *
 * Server component — no JS ships.
 */
export async function RequestAccessBrandOverlay() {
  const t = await getTranslations("auth.requestAccess");

  const chips: Array<{ icon: string; label: string; value: string }> = [
    { icon: "speed", label: t("chipLatencyLabel"), value: t("chipLatency") },
    { icon: "rocket_launch", label: t("chipVolumeLabel"), value: t("chipVolume") },
    { icon: "public", label: t("chipCoverageLabel"), value: t("chipCoverage") },
    { icon: "verified", label: t("chipRetentionLabel"), value: t("chipRetention") },
  ];

  const studios: Array<{ name: string; tag: string; accent: "full" | "mid" | "low" }> = [
    { name: t("studio1Name"), tag: t("studio1Tag"), accent: "full" },
    { name: t("studio2Name"), tag: t("studio2Tag"), accent: "mid" },
    { name: t("studio3Name"), tag: t("studio3Tag"), accent: "low" },
  ];

  const accentClass: Record<"full" | "mid" | "low", string> = {
    full: "border-cyan",
    mid: "border-cyan/40",
    low: "border-cyan/20",
  };

  return (
    <div className="relative z-20 flex h-full flex-col justify-between p-12 lg:p-16">
      {/* Top brand */}
      <div className="flex items-center gap-4">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-fixed-dim to-cyan-soft"
          style={{ boxShadow: "0 0 20px rgba(0, 229, 255, 0.3)" }}
          aria-hidden="true"
        >
          <span className="text-lg font-bold text-navy-base">K</span>
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">KOLMatrix</h1>
          <p className="text-[9px] font-semibold tracking-[0.2em] text-outline uppercase">
            {t("eyebrow")}
          </p>
        </div>
      </div>

      {/* Center text */}
      <div className="max-w-xl">
        <h2 className="text-4xl font-extrabold leading-tight tracking-tight text-white lg:text-5xl">
          {t.rich("heroTitle", {
            br: () => <br />,
            accent: (chunks) => (
              <span
                className="text-cyan"
                style={{ textShadow: "0 0 15px rgba(0, 229, 255, 0.6)" }}
              >
                {chunks}
              </span>
            ),
          })}
        </h2>
        <p className="mt-4 text-xl font-bold text-white opacity-90 lg:text-2xl">
          {t("heroTagline")}
        </p>
        <p className="mt-6 max-w-md text-base leading-relaxed text-on-surface-variant lg:text-lg">
          {t("heroSubtitle")}
        </p>

        {/* HUD chips grid */}
        <div className="mt-10 grid grid-cols-2 gap-4 lg:mt-12">
          {chips.map((chip) => (
            <div
              key={chip.icon}
              className="flex items-center gap-3 rounded-xl border border-cyan/10 bg-cyan/5 p-4 backdrop-blur-xl"
            >
              <span
                className="material-symbols-outlined text-cyan"
                aria-hidden="true"
              >
                {chip.icon}
              </span>
              <div>
                <p className="text-[10px] font-bold tracking-wider text-cyan-fixed uppercase">
                  {chip.label}
                </p>
                <p className="text-sm font-semibold text-white">{chip.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom social proof */}
      <div>
        <p className="mb-4 text-[11px] font-bold tracking-[0.1em] text-outline uppercase">
          {t("recentlyJoined")}
        </p>
        <div className="flex flex-wrap gap-4">
          {studios.map((studio) => (
            <div
              key={studio.name}
              className={`rounded-lg border-l-2 ${accentClass[studio.accent]} border border-cyan/10 bg-cyan/5 px-4 py-3 backdrop-blur-xl`}
            >
              <p className="text-xs font-bold text-white">{studio.name}</p>
              <p className="text-[10px] text-on-surface-variant">{studio.tag}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

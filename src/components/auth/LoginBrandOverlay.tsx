import { getTranslations } from "next-intl/server";

/**
 * Static cinematic overlay rendered on top of the world-map hero image
 * on the left 58% column of the login screen. Server component so the
 * next-intl lookups happen at render time and no JS ships to the client.
 *
 * Layout mirrors design-draft/stitch-references/login.html:
 *   - KOLMatrix wordmark + "CREATOR OPERATIONS · 2026" eyebrow (top)
 *   - Headline + subheadline + 4 floating HUD chips (middle)
 *   - "TRUSTED BY CREATORS WORKING WITH" + 5 placeholder studio logos (bottom)
 *
 * Color semantics map the Stitch Material palette onto Neural Velocity
 * tokens (see src/styles/globals.css):
 *   primary-container / primary-fixed-dim  →  cyan / cyan-fixed-dim
 *   primary-fixed                          →  cyan-fixed
 *   on-surface-variant                     →  on-surface-variant
 */
export async function LoginBrandOverlay() {
  const t = await getTranslations("auth.login");

  const chips: Array<{ icon: string; label: string }> = [
    { icon: "groups", label: t("chipCreators") },
    { icon: "auto_awesome", label: t("chipMatch") },
    { icon: "public", label: t("chipLocales") },
    { icon: "verified", label: t("chipStudios") },
  ];

  const studios = ["LIGHTNING", "VOIDPEAK", "STARFORGE", "AURORA", "NEBULA"];

  return (
    <div className="relative z-10 flex h-full w-full max-w-2xl flex-col p-12 lg:p-16">
      {/* Brand wordmark */}
      <div className="mb-auto flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <div
            className="h-2.5 w-2.5 rounded-full bg-cyan"
            style={{ boxShadow: "0 0 12px rgba(0, 229, 255, 0.8)" }}
            aria-hidden="true"
          />
          <span className="text-xl font-bold tracking-tight text-white uppercase">KOLMatrix</span>
        </div>
        <span className="ml-5 text-[10px] font-semibold tracking-[0.2em] text-on-surface-variant/60">
          {t("eyebrow")}
        </span>
      </div>

      {/* Content */}
      <div className="mb-16">
        <h1 className="mb-6 text-4xl font-extrabold leading-[1.1] tracking-[-0.02em] text-white lg:text-5xl">
          {t.rich("heroTitle", {
            br: () => <br />,
            accent: (chunks) => (
              <span
                className="text-cyan"
                style={{ textShadow: "0 0 15px rgba(0, 229, 255, 0.4)" }}
              >
                {chunks}
              </span>
            ),
          })}
        </h1>
        <p className="max-w-xl text-base font-medium leading-relaxed text-on-surface-variant lg:text-lg">
          {t("heroSubtitle")}
        </p>

        {/* HUD chips */}
        <div className="mt-10 flex flex-wrap gap-3">
          {chips.map((chip) => (
            <div
              key={chip.icon}
              className="flex items-center gap-2 rounded-full border border-outline-variant/30 bg-surface-highest/20 px-4 py-2 text-xs font-semibold text-cyan-fixed backdrop-blur-xl"
            >
              <span className="material-symbols-outlined text-sm" aria-hidden="true">
                {chip.icon}
              </span>
              {chip.label}
            </div>
          ))}
        </div>
      </div>

      {/* Trust footer */}
      <div className="mt-auto">
        <span className="mb-4 block text-[10px] font-bold tracking-[0.15em] text-on-surface-variant/40 uppercase">
          {t("trustedBy")}
        </span>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 opacity-40">
          {studios.map((name) => (
            <span
              key={name}
              className="text-xs font-bold tracking-[0.2em] text-on-surface-variant"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

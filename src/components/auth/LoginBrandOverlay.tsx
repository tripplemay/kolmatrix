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
  ];

  return (
    <div className="relative z-10 flex h-full w-full max-w-2xl flex-col p-12 lg:p-16">
      {/* Brand wordmark */}
      <div className="mb-auto flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <div
            className="bg-cyan h-2.5 w-2.5 rounded-full"
            style={{ boxShadow: "0 0 12px rgba(0, 229, 255, 0.8)" }}
            aria-hidden="true"
          />
          <span className="text-xl font-bold tracking-tight text-white uppercase">KOLMatrix</span>
        </div>
        <span className="text-on-surface-variant/60 ml-5 text-[10px] font-semibold tracking-[0.2em]">
          {t("eyebrow")}
        </span>
      </div>

      {/* Content */}
      <div className="mb-16">
        <h1 className="mb-6 text-4xl leading-[1.1] font-extrabold tracking-[-0.02em] text-white lg:text-5xl">
          {t.rich("heroTitle", {
            br: () => <br />,
            accent: (chunks) => (
              <span className="text-cyan" style={{ textShadow: "0 0 15px rgba(0, 229, 255, 0.4)" }}>
                {chunks}
              </span>
            ),
          })}
        </h1>
        <p className="text-on-surface-variant max-w-xl text-base leading-relaxed font-medium lg:text-lg">
          {t("heroSubtitle")}
        </p>

        {/* HUD chips */}
        <div className="mt-10 flex flex-wrap gap-3">
          {chips.map((chip) => (
            <div
              key={chip.icon}
              className="border-outline-variant/30 bg-surface-highest/20 text-cyan-fixed flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold backdrop-blur-xl"
            >
              <span className="material-symbols-outlined text-sm" aria-hidden="true">
                {chip.icon}
              </span>
              {chip.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

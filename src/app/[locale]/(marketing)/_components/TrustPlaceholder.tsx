import { getTranslations } from "next-intl/server";

/**
 * BL-114-F002 — Logo strip, rebuilt to the Stitch "Neural Velocity"
 * prototype: a "Trusted by leading game studios" mono caption above five
 * muted/grayscale studio wordmarks. The wordmarks are intentional
 * placeholders (spec F002 "可占位") — fictional brand names, not real
 * customer claims — pending real partner logos.
 */
const WORDMARKS = ["ZENITH", "NEXUS_G", "VOID_LABS", "APEX_INT", "STORM_WK"] as const;

export async function TrustPlaceholder() {
  const t = await getTranslations("landing.trust");

  return (
    <section
      data-testid="landing-logos"
      className="border-y border-outline-variant/5 bg-navy-base px-6 py-12 lg:px-8"
    >
      <div className="mx-auto max-w-7xl">
        <p className="mb-10 text-center font-landing-mono text-[10px] uppercase tracking-[0.25em] text-on-surface-variant">
          {t("caption")}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-12 opacity-40 contrast-125 grayscale md:gap-20">
          {WORDMARKS.map((name) => (
            <span
              key={name}
              data-testid={`landing-logo-${name}`}
              className="text-2xl font-black italic tracking-tighter text-white"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

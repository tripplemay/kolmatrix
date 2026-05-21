import { getTranslations } from "next-intl/server";
import { StickyStack } from "@/components/landing/StickyStack";
import { ScrollFadeIn } from "@/components/landing/ScrollFadeIn";

interface TrustItem {
  key: "encryption" | "email" | "stack";
  icon: string;
}

const ITEMS: ReadonlyArray<TrustItem> = [
  { key: "encryption", icon: "lock" },
  { key: "email", icon: "verified" },
  { key: "stack", icon: "hub" },
];

export async function TrustPlaceholder() {
  const t = await getTranslations("landing.trust");

  return (
    <StickyStack
      sectionTestId="landing-trust"
      bgClassName="bg-surface-light"
      textClassName="text-on-surface-light"
      leftContent={
        <>
          <div className="font-geist-mono text-[11px] tracking-[0.3em] text-cyan uppercase">
            {t("intro.label")}
          </div>
          <h2 className="mt-4 font-geist text-4xl lg:text-5xl font-bold tracking-tight whitespace-pre-line">
            {t("intro.title")}
          </h2>
          <p className="mt-5 text-base text-on-surface-light-variant max-w-md leading-relaxed">
            {t("intro.subtitle")}
          </p>
        </>
      }
    >
      {ITEMS.map(({ key, icon }, idx) => (
        <ScrollFadeIn key={key} delayMs={idx * 150}>
          <div
            data-testid={`landing-trust-${key}`}
            className="rounded-2xl border border-on-surface-light/10 bg-surface-light-container p-8 transition hover:border-cyan/40 hover:shadow-[0_8px_28px_rgba(0,229,255,0.15)]"
          >
            <span
              className="material-symbols-outlined text-[32px] text-cyan"
              aria-hidden="true"
            >
              {icon}
            </span>
            <h3 className="mt-5 font-geist text-lg font-semibold text-on-surface-light">
              {t(`items.${key}.title`)}
            </h3>
            <p className="mt-3 text-sm text-on-surface-light-variant leading-relaxed">
              {t(`items.${key}.body`)}
            </p>
          </div>
        </ScrollFadeIn>
      ))}
    </StickyStack>
  );
}

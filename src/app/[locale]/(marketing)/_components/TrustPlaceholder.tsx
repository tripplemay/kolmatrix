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
          <div className="font-geist-mono text-landing-eyebrow tracking-landing-eyebrow text-cyan uppercase">
            {t("intro.label")}
          </div>
          <h2 className="mt-4 font-geist text-landing-h2 font-bold leading-landing-tight tracking-landing-tight whitespace-pre-line">
            {t("intro.title")}
          </h2>
          <p className="mt-5 text-landing-body-lg leading-landing-relaxed text-on-surface-light-variant max-w-md">
            {t("intro.subtitle")}
          </p>
        </>
      }
    >
      {ITEMS.map(({ key, icon }, idx) => (
        <ScrollFadeIn key={key} delayMs={idx * 150}>
          <div
            data-testid={`landing-trust-${key}`}
            className="landing-card-light p-8"
          >
            <span className="landing-icon-halo" style={{ width: "56px", height: "56px" }}>
              <span
                className="material-symbols-outlined text-[28px]"
                aria-hidden="true"
              >
                {icon}
              </span>
            </span>
            <h3 className="mt-5 font-geist text-landing-h3 font-semibold leading-landing-tight tracking-landing-tight text-on-surface-light">
              {t(`items.${key}.title`)}
            </h3>
            <p className="mt-3 text-landing-body leading-landing-relaxed text-on-surface-light-variant">
              {t(`items.${key}.body`)}
            </p>
          </div>
        </ScrollFadeIn>
      ))}
    </StickyStack>
  );
}

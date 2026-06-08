import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { StickyParallax } from "@/components/landing/StickyParallax";
import { resolveLandingAsset } from "./illustration-asset";

export async function EmailCenterDemo() {
  const t = await getTranslations("landing.demo");
  const callouts = t.raw("callouts") as ReadonlyArray<{ title: string; body: string }>;
  // BL-080-F003 — prefer the email-center illustration; fall back to the
  // BL-078 /match screenshot if the PNG was not delivered.
  const src = resolveLandingAsset(
    "/landing/illustrations/email-center-illustration.png",
    "/landing/screenshots/match-full.png"
  );

  return (
    <StickyParallax
      sectionTestId="landing-demo"
      bgClassName="bg-surface"
      textClassName="text-on-surface"
      stickyAsset={
        <div className="overflow-hidden rounded-[var(--radius-landing-card)] border border-cyan/22 shadow-[0_18px_56px_color-mix(in_srgb,var(--color-cyan)_22%,transparent)]">
          <Image
            src={src}
            alt={t("illustrationAlt")}
            width={1376}
            height={768}
            quality={80}
            sizes="(max-width: 1024px) 100vw, 600px"
            className="h-auto w-full"
          />
        </div>
      }
      callouts={callouts.map((c, idx) => (
        <div key={idx} data-testid={`landing-demo-callout-${idx}`}>
          <h3 className="font-geist text-landing-h2 font-bold leading-landing-tight tracking-landing-tight text-landing-ink">
            {c.title}
          </h3>
          <p className="mt-4 text-landing-body-lg leading-landing-relaxed text-landing-ink-muted max-w-md">
            {c.body}
          </p>
        </div>
      ))}
    />
  );
}

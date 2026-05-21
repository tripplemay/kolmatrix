import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { StickyParallax } from "@/components/landing/StickyParallax";

export async function EmailCenterDemo() {
  const t = await getTranslations("landing.demo");
  const callouts = t.raw("callouts") as ReadonlyArray<{ title: string; body: string }>;

  return (
    <StickyParallax
      sectionTestId="landing-demo"
      bgClassName="bg-surface"
      textClassName="text-on-surface"
      stickyAsset={
        <div className="overflow-hidden rounded-2xl border border-cyan/20 shadow-[0_12px_48px_rgba(0,229,255,0.15)]">
          <Image
            src="/landing/screenshots/match-full.png"
            alt={t("screenshotAlt")}
            width={1080}
            height={720}
            className="h-auto w-full"
          />
        </div>
      }
      callouts={callouts.map((c, idx) => (
        <div key={idx} data-testid={`landing-demo-callout-${idx}`}>
          <h3 className="font-geist text-2xl lg:text-3xl font-bold tracking-tight text-white">
            {c.title}
          </h3>
          <p className="mt-4 text-base text-on-surface-variant leading-relaxed max-w-md">
            {c.body}
          </p>
        </div>
      ))}
    />
  );
}

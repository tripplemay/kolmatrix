import Image from "next/image";
import { getTranslations } from "next-intl/server";

const SCREENSHOTS: ReadonlyArray<{
  key: "match" | "reach" | "insight";
  src: string;
}> = [
  { key: "match", src: "/landing/screenshots/match-full.png" },
  { key: "reach", src: "/landing/screenshots/reach-full.png" },
  { key: "insight", src: "/landing/screenshots/insight-full.png" },
];

export async function EmailCenterDemo() {
  const t = await getTranslations("landing.demo");
  const steps = t.raw("steps") as ReadonlyArray<string>;

  return (
    <section
      data-testid="landing-demo"
      className="bg-surface-container-lowest px-6 py-24 lg:px-12"
    >
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center text-2xl font-bold tracking-tight text-white lg:text-3xl">
          {t("sectionTitle")}
        </h2>
        <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {SCREENSHOTS.map(({ key, src }) => (
            <div
              key={key}
              data-testid={`landing-demo-${key}`}
              className="overflow-hidden rounded-2xl border border-cyan/15 shadow-[0_8px_24px_rgba(0,0,0,0.3)]"
            >
              <Image
                src={src}
                alt={t(`screenshotAlts.${key}`)}
                width={640}
                height={400}
                className="h-auto w-full"
              />
            </div>
          ))}
        </div>

        {/* flow strip */}
        <ol className="mt-12 flex flex-wrap items-center justify-center gap-3 text-xs text-primary-fixed sm:text-sm">
          {steps.map((step, idx) => (
            <li key={step} className="flex items-center gap-3">
              <span className="rounded-full border border-cyan/30 bg-cyan/10 px-3 py-1 font-semibold">
                {idx + 1}. {step}
              </span>
              {idx < steps.length - 1 && (
                <span className="text-cyan/60" aria-hidden="true">→</span>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

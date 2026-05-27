import { getTranslations } from "next-intl/server";
import { ScrollFadeIn } from "@/components/landing/ScrollFadeIn";

interface FaqItem {
  q: string;
  a: string;
}

export async function FAQ() {
  const t = await getTranslations("landing.faq");
  const items = t.raw("items") as ReadonlyArray<FaqItem>;

  return (
    <section
      data-testid="landing-faq"
      className="bg-surface text-on-surface px-6 lg:px-12"
      style={{ paddingTop: "var(--spacing-landing-section-y)", paddingBottom: "var(--spacing-landing-section-y)" }}
    >
      <ScrollFadeIn>
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center font-geist text-landing-h2 font-bold leading-landing-tight tracking-landing-tight text-landing-ink">
            {t("sectionTitle")}
          </h2>
          <ul className="mt-12 space-y-3">
            {items.map((item, idx) => (
              <li
                key={item.q}
                className="overflow-hidden rounded-[var(--radius-landing-card)] border border-cyan/15 bg-landing-canvas-elevated/60"
              >
                <details data-testid={`landing-faq-item-${idx}`} className="landing-faq-item group">
                  <summary
                    className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 text-landing-body font-semibold text-landing-ink transition-colors hover:bg-cyan/5"
                    style={{ transitionDuration: "var(--duration-landing-short)" }}
                  >
                    <span className="font-geist leading-landing-tight">{item.q}</span>
                    <span className="landing-faq-chevron text-cyan text-xl leading-none" aria-hidden="true">
                      +
                    </span>
                  </summary>
                  <div className="border-t border-cyan/10 p-5 text-landing-body leading-landing-relaxed text-landing-ink-muted">
                    {item.a}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </div>
      </ScrollFadeIn>
    </section>
  );
}

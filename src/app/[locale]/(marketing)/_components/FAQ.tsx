import { getTranslations } from "next-intl/server";

/**
 * BL-114-F003 — FAQ, restyled to the Stitch "Neural Velocity" prototype:
 * tonal-layered accordion cards (bg-surface-low → hover bg-surface-high, no
 * borders) with an expand_more chevron that flips on open. Question/answer
 * content stays the product-accurate copy (only the visual treatment changes).
 */
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
      className="bg-navy-base px-6 py-24 lg:px-8 lg:py-32"
    >
      <div className="mx-auto max-w-3xl">
        <h2 className="mb-16 text-center text-3xl font-extrabold text-white">
          {t("sectionTitle")}
        </h2>
        <div className="space-y-4">
          {items.map((item, idx) => (
            <details
              key={item.q}
              data-testid={`landing-faq-item-${idx}`}
              className="landing-faq-item group overflow-hidden rounded-lg bg-surface-low"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-6 transition-colors duration-[var(--duration-landing-short)] hover:bg-surface-high">
                <span className="text-lg font-bold text-white">{item.q}</span>
                <span
                  className="landing-faq-chevron material-symbols-outlined text-cyan-fixed-dim"
                  aria-hidden="true"
                >
                  expand_more
                </span>
              </summary>
              <div className="p-6 pt-0 leading-relaxed text-on-surface-variant">{item.a}</div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

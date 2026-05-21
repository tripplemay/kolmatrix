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
      className="bg-surface text-on-surface px-6 py-32 lg:px-12"
    >
      <ScrollFadeIn>
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center font-geist text-3xl lg:text-4xl font-bold tracking-tight text-white">
            {t("sectionTitle")}
          </h2>
          <ul className="mt-12 space-y-3">
            {items.map((item, idx) => (
              <li
                key={item.q}
                className="overflow-hidden rounded-2xl border border-cyan/15 bg-surface-low"
              >
                <details data-testid={`landing-faq-item-${idx}`} className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 text-sm font-semibold text-white transition hover:bg-cyan/5">
                    <span className="font-geist">{item.q}</span>
                    <span className="text-cyan transition group-open:rotate-45" aria-hidden="true">
                      +
                    </span>
                  </summary>
                  <div className="border-t border-cyan/10 p-5 text-sm leading-6 text-on-surface-variant">
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

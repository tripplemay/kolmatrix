/**
 * 2026-05-19 landing page · Marketing landing page composition root.
 *
 * Stage 1 ships an empty shell so middleware + page.tsx routing can
 * be verified end-to-end before the section components land in
 * Stage 2 (Tasks 6-12).
 */
interface Props {
  locale: string;
}

export function LandingPage({ locale }: Props) {
  return (
    <main
      className="min-h-screen bg-surface text-on-surface"
      data-testid="landing-page"
      data-locale={locale}
    >
      <section data-testid="landing-hero" className="px-6 py-20 text-center">
        <h1 className="text-3xl font-bold text-white">KolMatrix</h1>
        <p className="mt-4 text-on-surface-variant">
          [Stage 2 — section components land here]
        </p>
      </section>
    </main>
  );
}

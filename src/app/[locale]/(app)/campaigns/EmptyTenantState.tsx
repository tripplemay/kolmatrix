/**
 * MVP-vf-F004 · Empty-state card shown when the tenant has zero
 * campaigns (vs. zero filter matches — that uses a softer hint).
 *
 * Pure presentation; pulled out of page.tsx so the parent file stays
 * under the ≤20 hardcoded className UI-fidelity threshold.
 */
import Link from "next/link";

interface Props {
  title: string;
  body: string;
  cta: string;
  ctaHref: string;
}

export function EmptyTenantState({ title, body, cta, ctaHref }: Props) {
  return (
    <div
      className="glass-panel flex flex-col items-center gap-3 rounded-2xl border border-on-surface/5 p-12 text-center"
      data-testid="campaigns-empty"
    >
      <span
        className="material-symbols-outlined text-[48px] text-cyan/50"
        aria-hidden
      >
        rocket_launch
      </span>
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <p className="max-w-md text-sm text-on-surface-variant">{body}</p>
      <Link
        href={ctaHref}
        data-testid="campaigns-empty-cta"
        className="gradient-cta mt-2 rounded-lg px-5 py-2 text-sm font-bold text-on-primary"
      >
        {cta}
      </Link>
    </div>
  );
}

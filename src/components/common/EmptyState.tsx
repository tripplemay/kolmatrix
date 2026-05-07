/**
 * EmptyState — shared empty-state primitive (BL-052 F006 / Part B).
 *
 * Used when a tenant-scoped list returns 0 rows and we want to show a
 * friendly "nothing here yet" tile with an optional CTA. Mirrors the
 * visual language of the existing private variants
 * (discovery/EmptyState, WeeklyReportEmptyState, AssetsEmptyState) so
 * the new pages adopt a consistent tone without forcing the legacy 4
 * to migrate immediately (BL-053 deferred).
 *
 * Props are deliberately permissive on the CTA shape: pass `href` for
 * a Next-Link navigation, `onClick` for a client action (modal open,
 * server action wrapper), or omit both for a CTA-less informational
 * tile. Both `href` and `onClick` together is supported (matches some
 * external link semantics).
 */
"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";

export interface EmptyStateCta {
  label: string;
  href?: string;
  onClick?: () => void;
}

export interface EmptyStateProps {
  /** Material symbols icon name, e.g. "inventory_2", "groups", "campaign". */
  icon: string;
  /** Short headline (already passed through next-intl t()). */
  title: string;
  /** Supporting copy (already passed through next-intl t()). */
  description: string;
  cta?: EmptyStateCta;
  /** Pinned to data-testid so callers can target the tile in tests. */
  testId?: string;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  cta,
  testId,
  className,
}: EmptyStateProps) {
  return (
    <div
      data-testid={testId}
      className={cn(
        "mx-auto flex max-w-2xl flex-col items-center gap-4 rounded-2xl border border-white/5 bg-surface-low/60 p-12 text-center",
        className
      )}
    >
      <span aria-hidden className="material-symbols-outlined text-5xl text-cyan/60">
        {icon}
      </span>
      <h2 className="text-xl font-bold text-white">{title}</h2>
      <p className="max-w-md text-sm text-on-surface-variant">{description}</p>
      {cta ? <EmptyStateCtaButton cta={cta} testId={testId} /> : null}
    </div>
  );
}

function EmptyStateCtaButton({ cta, testId }: { cta: EmptyStateCta; testId?: string }) {
  const ctaTestId = testId ? `${testId}-cta` : undefined;
  const className =
    "rounded-xl bg-gradient-to-br from-[#00daf3] to-[#c3f5ff] px-6 py-3 text-sm font-bold text-on-primary";

  if (cta.href) {
    return (
      <Link
        href={cta.href}
        onClick={cta.onClick}
        className={className}
        data-testid={ctaTestId}
      >
        {cta.label}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={cta.onClick}
      className={className}
      data-testid={ctaTestId}
    >
      {cta.label}
    </button>
  );
}

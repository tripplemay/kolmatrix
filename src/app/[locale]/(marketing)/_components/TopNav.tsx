import Link from "next/link";
import { getTranslations } from "next-intl/server";

interface Props {
  locale: string;
}

/**
 * BL-114-F001 (redo) — glass nav aligned to the Stitch "Neural Velocity"
 * prototype: gradient K logo tile + gradient KOLMatrix wordmark, Inter
 * type, and the shared `landing-cta-primary` gradient button. Product /
 * Pricing / Docs links from the prototype are omitted — there are no such
 * pages, and dead anchors would violate the no-ghost-control guardrail.
 */
export async function TopNav({ locale }: Props) {
  const t = await getTranslations("landing.nav");

  return (
    <nav
      data-testid="landing-topnav"
      className="landing-topnav-glass sticky top-0 z-50"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
        <Link
          href={`/${locale}`}
          className="flex items-center gap-2.5"
          data-testid="landing-topnav-logo"
        >
          <span
            aria-hidden
            className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-gradient-to-br from-cyan-fixed-dim to-cyan-soft text-base font-bold text-on-primary"
          >
            K
          </span>
          <span className="gradient-text text-lg font-bold tracking-tight">KOLMatrix</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href={`/${locale}/login`}
            className="hidden text-sm font-medium text-on-surface-variant transition-colors duration-[var(--duration-landing-short)] hover:text-white sm:inline-flex"
            data-testid="landing-topnav-login"
          >
            {t("login")}
          </Link>
          <Link
            href={`/${locale}/request-access`}
            className="landing-cta-primary inline-flex items-center rounded-md px-5 py-2 text-sm font-bold"
            data-testid="landing-topnav-cta"
          >
            {t("cta")}
          </Link>
        </div>
      </div>
    </nav>
  );
}

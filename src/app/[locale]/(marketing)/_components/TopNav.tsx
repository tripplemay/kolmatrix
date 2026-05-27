import Link from "next/link";
import { getTranslations } from "next-intl/server";

interface Props {
  locale: string;
}

export async function TopNav({ locale }: Props) {
  const t = await getTranslations("landing.nav");

  return (
    <nav
      data-testid="landing-topnav"
      className="landing-topnav-glass sticky top-0 z-50 font-geist"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 lg:px-12">
        <Link
          href={`/${locale}`}
          className="flex items-center gap-2 text-sm font-bold tracking-[0.18em] text-landing-ink uppercase transition-colors duration-[var(--duration-landing-short)] hover:text-cyan"
          data-testid="landing-topnav-logo"
        >
          <span className="material-symbols-outlined text-[20px] text-cyan" aria-hidden="true">
            hub
          </span>
          KolMatrix
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href={`/${locale}/login`}
            className="hidden text-sm font-medium text-landing-ink-muted transition-colors duration-[var(--duration-landing-short)] hover:text-landing-ink sm:inline-flex"
            data-testid="landing-topnav-login"
          >
            {t("login")}
          </Link>
          <Link
            href={`/${locale}/request-access`}
            className="landing-cta-primary inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold"
            data-testid="landing-topnav-cta"
          >
            {t("cta")}
          </Link>
        </div>
      </div>
    </nav>
  );
}

/**
 * BL-084-F007 · AI ↔ full-pool toggle for /match?campaignId=X.
 *
 * Two links that preserve campaignId while flipping `view` between `ai`
 * and `full-pool`. Rendered only when a campaign context is present
 * (toggle is meaningless without a campaignId). URL-driven (no
 * localStorage) per spec §5.
 */
import Link from "next/link";
import { getTranslations } from "next-intl/server";

interface Props {
  campaignId: string;
  locale: string;
  active: "ai" | "full-pool";
}

export async function MatchViewToggle({ campaignId, locale, active }: Props) {
  const t = await getTranslations({ locale, namespace: "match.toggle" });
  const base = `/${locale}/match?campaignId=${campaignId}`;

  const tabClass = (on: boolean) =>
    `rounded-lg px-3 py-1.5 text-sm font-medium transition ${
      on
        ? "bg-cyan text-navy-base"
        : "border border-white/15 text-on-surface-variant hover:text-white"
    }`;

  return (
    <div
      data-testid="match-view-toggle"
      data-active={active}
      className="inline-flex items-center gap-2"
    >
      <Link
        href={`${base}&view=ai`}
        data-testid="toggle-ai"
        aria-current={active === "ai" ? "page" : undefined}
        className={tabClass(active === "ai")}
      >
        {t("aiMode")}
      </Link>
      <Link
        href={`${base}&view=full-pool`}
        data-testid="toggle-full-pool"
        aria-current={active === "full-pool" ? "page" : undefined}
        className={tabClass(active === "full-pool")}
      >
        {t("fullPoolMode")}
      </Link>
    </div>
  );
}

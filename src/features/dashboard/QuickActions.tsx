/**
 * QuickActions — Dashboard 快捷操作 4 按钮（BM1-F007 新增）
 *
 * Marketers' first-click launchpad into the 3 BM1 features (Knowledge
 * Base / Discovery / Database) and a preview of BM2 (Campaigns,
 * disabled with "Coming soon" tooltip; tracked in backlog/spec docs).
 * Kept in /features/dashboard/
 * alongside KpiRow + ActiveCampaignsSection so imports stay local to
 * the dashboard tree.
 */
import { getTranslations } from "next-intl/server";
import Link from "next/link";

interface QuickAction {
  key: "knowledgeBase" | "discovery" | "database";
  href: string | null;
  icon: string;
  tone: "cyan" | "purple" | "cyan-soft" | "neutral";
}

// BL-074-F003 — dropped the `campaigns` entry (was the 4th button). The
// sidebar's first-class `Campaigns` nav (BL-074-F001 / ADR-015) is now
// the canonical entry point, so an additional QuickActions button is
// redundant. Grid collapses from `sm:grid-cols-4` to `sm:grid-cols-3`
// so the 3 buttons span the row instead of leaving a visual gap.
//
// Note: `dashboard.quickActions.campaigns` + `*Description` translation
// keys stay in the locale bundles (deprecated marker comments are
// noisy in JSON; the i18n-locale-coverage gate would not complain
// either way). Re-using them is fine if a future iteration adds the
// button back.
const ACTIONS: QuickAction[] = [
  { key: "knowledgeBase", href: "/brief?tab=products", icon: "inventory_2", tone: "cyan" },
  { key: "discovery", href: "/match", icon: "travel_explore", tone: "cyan-soft" },
  { key: "database", href: "/match?view=table", icon: "groups", tone: "purple" },
];

const TONE_CLASS: Record<QuickAction["tone"], string> = {
  cyan: "bg-brand-500/15 text-brand-400 border-brand-500/30",
  "cyan-soft": "bg-brand-500/10 text-brand-300 border-brand-500/25",
  purple: "bg-purple/15 text-purple border-purple/25",
  neutral: "bg-surface-high text-on-surface-variant border-outline-variant",
};

interface Props {
  locale: string;
}

export async function QuickActions({ locale }: Props) {
  const t = await getTranslations("dashboard.quickActions");
  return (
    <section
      className="grid grid-cols-1 gap-3 sm:grid-cols-3"
      data-testid="dashboard-quick-actions"
    >
      {ACTIONS.map((a) => {
        const title = t(a.key);
        const description = t(`${a.key}Description` as
          | "knowledgeBaseDescription"
          | "discoveryDescription"
          | "databaseDescription");
        const disabled = a.href === null;
        const className = `flex items-center gap-3 rounded-xl border p-4 transition-colors ${TONE_CLASS[a.tone]} ${
          disabled
            ? "cursor-not-allowed opacity-60"
            : "hover:brightness-110"
        }`;
        const content = (
          <>
            <span
              className="material-symbols-outlined text-2xl shrink-0"
              aria-hidden
            >
              {a.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-white">
                {title}
                {disabled ? (
                  <span className="ml-2 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-on-surface-variant">
                    {t("comingSoon")}
                  </span>
                ) : null}
              </span>
              <span className="block text-[11px] text-on-surface-variant">
                {description}
              </span>
            </span>
          </>
        );
        if (disabled) {
          return (
            <div
              key={a.key}
              className={className}
              title={t("comingSoonTooltip")}
              aria-disabled
              data-testid={`quick-action-${a.key}`}
            >
              {content}
            </div>
          );
        }
        return (
          <Link
            key={a.key}
            href={`/${locale}${a.href!}`}
            className={className}
            data-testid={`quick-action-${a.key}`}
          >
            {content}
          </Link>
        );
      })}
    </section>
  );
}

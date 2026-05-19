/**
 * BL-070-F003 · /insight tab bar (server component, no client state).
 *
 * URL-driven (`?tab=dashboard|reports|analytics`); default = dashboard.
 * Extracted from `page.tsx` so the pure-function helper + the rendered
 * markup can be unit-tested without mounting the heavy `DashboardPage`
 * server component the page composes for the dashboard tab.
 */
import Link from "next/link";

export type InsightTab = "dashboard" | "reports" | "analytics";

export const INSIGHT_TABS: readonly InsightTab[] = [
  "dashboard",
  "reports",
  "analytics",
] as const;

/**
 * Resolve the `?tab=` query value into a typed `InsightTab`. Any
 * unknown value (including missing) collapses to "dashboard" so the
 * route always renders something useful even if the caller hands in a
 * malformed deep link.
 */
export function pickInsightTab(
  raw: string | string[] | undefined,
): InsightTab {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === "reports" || value === "analytics") return value;
  return "dashboard";
}

interface TabLabels {
  dashboard: string;
  reports: string;
  analytics: string;
}

interface Props {
  locale: string;
  activeTab: InsightTab;
  /** Visible label per tab. Falls back to capitalised English. */
  labels?: TabLabels;
}

const DEFAULT_LABELS: TabLabels = {
  dashboard: "Dashboard",
  reports: "Reports",
  analytics: "Analytics",
};

function hrefFor(locale: string, tab: InsightTab): string {
  if (tab === "dashboard") return `/${locale}/insight`;
  return `/${locale}/insight?tab=${tab}`;
}

export function InsightTabs({ locale, activeTab, labels = DEFAULT_LABELS }: Props) {
  return (
    <nav
      className="flex gap-1 border-b border-on-surface/10"
      data-testid="insight-tabs"
    >
      {INSIGHT_TABS.map((tab) => {
        const isActive = tab === activeTab;
        return (
          <Link
            key={tab}
            href={hrefFor(locale, tab)}
            data-testid={`insight-tab-${tab}`}
            aria-current={isActive ? "page" : undefined}
            className={
              isActive
                ? "border-b-2 border-cyan px-4 py-2 text-sm font-bold text-cyan"
                : "px-4 py-2 text-sm font-medium text-on-surface-variant hover:text-on-surface"
            }
          >
            {labels[tab]}
          </Link>
        );
      })}
    </nav>
  );
}

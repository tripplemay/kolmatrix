/**
 * BM2-F006 · Sub-nav tabs strip.
 *
 * Per adjudication §12 #B: Overview active, the rest disabled with
 * tooltips pointing at the B4 roadmap. Badge counts (24 / 87 / 142)
 * are intentionally static placeholders — the real numbers require
 * Template library + Send queue + Suppression list that don't exist
 * in MVP.
 */
import { getTranslations } from "next-intl/server";

interface TabSpec {
  id: "overview" | "templates" | "send_queue" | "tracking" | "suppression";
  badge?: number;
  tooltipKey?: string;
}

const TABS: TabSpec[] = [
  { id: "overview" },
  { id: "templates", badge: 10, tooltipKey: "comingB4" },
  { id: "send_queue", badge: 0, tooltipKey: "comingB4" },
  { id: "tracking", tooltipKey: "comingB4" },
  { id: "suppression", badge: 0, tooltipKey: "comingB4" },
];

export async function OutreachTabs() {
  const t = await getTranslations("outreach.tabs");
  return (
    <nav
      aria-label="Outreach sections"
      data-testid="outreach-tabs"
      className="glass-panel flex w-full items-center gap-1 rounded-xl border border-on-surface/5 p-1"
    >
      {TABS.map((tab) => {
        const isActive = tab.id === "overview";
        const label = t(tab.id);
        const tooltip = tab.tooltipKey ? t(tab.tooltipKey) : undefined;
        return (
          <button
            key={tab.id}
            type="button"
            disabled={!isActive}
            title={tooltip}
            data-testid={`outreach-tab-${tab.id}`}
            data-active={isActive ? "true" : undefined}
            className={
              isActive
                ? "flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold text-cyan shadow-[inset_0_-2px_0_0_rgba(0,229,255,0.8)]"
                : "flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-medium text-on-surface-variant/70 hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-60"
            }
          >
            <span>{label}</span>
            {tab.badge !== undefined ? (
              <span className="rounded-full bg-surface-high/60 px-2 py-0.5 text-[10px] font-bold">
                {tab.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}

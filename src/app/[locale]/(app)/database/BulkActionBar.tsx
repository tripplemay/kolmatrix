"use client";

/**
 * MVP-vf-F003 · Floating Bulk Action Bar.
 *
 * Renders only when at least one row is selected. Three actions per the
 * Stitch prototype:
 *   - Add to Campaign     (real, opens AddToCampaignDialog)
 *   - Email               (disabled — point users at /outreach instead)
 *   - Delete              (disabled — destructive bulk actions wait for B6)
 *
 * Stays a client component because the selection state is owned by the
 * parent table client. Pure presentation here; mutation lives inside
 * AddToCampaignDialog.
 */
import { Button } from "@/components/ui";

interface Props {
  count: number;
  onAddToCampaign: () => void;
  labels: {
    selected: string;
    addToCampaign: string;
    email: string;
    emailTooltip: string;
    delete: string;
    deleteTooltip: string;
    clear: string;
  };
  onClear: () => void;
}

export function BulkActionBar({ count, onAddToCampaign, onClear, labels }: Props) {
  if (count === 0) return null;

  return (
    <div
      className="fixed bottom-8 left-1/2 z-40 -translate-x-1/2"
      role="region"
      aria-label="Bulk actions"
      data-testid="database-bulk-bar"
    >
      <div className="glass-panel flex min-w-[520px] items-center gap-6 rounded-2xl border border-white/10 bg-navy-base/70 px-6 py-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
        <div className="flex items-center gap-3 border-r border-white/10 pr-6">
          <span
            className="text-2xl font-bold text-cyan"
            data-testid="bulk-bar-count"
          >
            {count}
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
            {labels.selected}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={onAddToCampaign}
            data-testid="bulk-bar-add-to-campaign"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden>
              add_to_photos
            </span>
            {labels.addToCampaign}
          </Button>
          <Button
            variant="ghost"
            disabled
            title={labels.emailTooltip}
            data-testid="bulk-bar-email"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden>
              mail
            </span>
            {labels.email}
          </Button>
          <Button
            variant="danger"
            disabled
            title={labels.deleteTooltip}
            data-testid="bulk-bar-delete"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden>
              delete_outline
            </span>
            {labels.delete}
          </Button>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="ml-auto text-xs text-on-surface-variant hover:text-cyan"
          data-testid="bulk-bar-clear"
        >
          {labels.clear}
        </button>
      </div>
    </div>
  );
}

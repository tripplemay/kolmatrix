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
 * Calls `useTranslations` directly instead of accepting a labels object
 * from the server parent — passing static i18n strings as props would
 * waste the RSC bundle and we already pay for the next-intl client
 * runtime once any descendant uses it.
 */
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui";

interface Props {
  count: number;
  onAddToCampaign: () => void;
  onClear: () => void;
}

export function BulkActionBar({ count, onAddToCampaign, onClear }: Props) {
  const t = useTranslations("database.bulk");
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
            {t("selected")}
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
            {t("addToCampaign")}
          </Button>
          <Button
            variant="ghost"
            disabled
            title={t("emailTooltip")}
            data-testid="bulk-bar-email"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden>
              mail
            </span>
            {t("email")}
          </Button>
          <Button
            variant="danger"
            disabled
            title={t("deleteTooltip")}
            data-testid="bulk-bar-delete"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden>
              delete_outline
            </span>
            {t("delete")}
          </Button>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="ml-auto text-xs text-on-surface-variant hover:text-cyan"
          data-testid="bulk-bar-clear"
        >
          {t("clear")}
        </button>
      </div>
    </div>
  );
}

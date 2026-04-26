"use client";

/**
 * MVP-vf-F003 · Bulk "Add to Campaign" dialog.
 *
 * Opens from the BulkActionBar with a list of selected `kolIds`. Fetches
 * the tenant's campaigns lazily (on first open) so the page-level data
 * load isn't paying for it. Posts to `/api/campaigns/:id/kols/bulk` and
 * then forces a router refresh so the count cards / status pills pick
 * up the new audit_log + spendTotal.
 *
 * Calls `useTranslations` directly: the body string has a {count} ICU
 * placeholder bound to `selectedIds.length`, and forwarding that
 * pre-formatted value as a server prop would either evaluate the
 * placeholder server-side at render time (with the wrong count) or
 * leave the raw `{count}` token to leak into the UI. Inlining
 * `useTranslations` here keeps the placeholder bound to the live
 * selection state (BM2 F011 RSC function-prop lesson — pre-format
 * strings, never callbacks).
 */
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import {
  Button,
  Dialog,
  DialogBackdrop,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPortal,
  DialogTitle,
  Select,
} from "@/components/ui";

interface CampaignOption {
  id: string;
  name: string;
  status: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  /** Called after a successful bulk-add so the parent can clear selection. */
  onAdded: (result: BulkAddResult) => void;
}

export interface BulkAddResult {
  added: number;
  skipped: number;
  notFound: number;
  newSpendTotal: number;
}

export function AddToCampaignDialog({
  open,
  onOpenChange,
  selectedIds,
  onAdded,
}: Props) {
  const t = useTranslations("database.dialog");
  const [campaigns, setCampaigns] = useState<CampaignOption[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [campaignId, setCampaignId] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Derived loading flag: dialog is open, no fetch result yet, no
  // error. Lets us skip a redundant `loading` useState call inside
  // useEffect (react-hooks/set-state-in-effect would flag that).
  const loading = open && campaigns === null && !error;

  const loadCampaigns = useCallback(async () => {
    try {
      const res = await fetch("/api/campaigns?status=active,draft", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("fetch_failed");
      const json = (await res.json()) as { items?: CampaignOption[] };
      const list = (json.items ?? []) as CampaignOption[];
      setCampaigns(list);
      setCampaignId(list[0]?.id ?? "");
    } catch (err) {
      console.error("[AddToCampaignDialog] load campaigns failed", err);
      setError(t("errorGeneric"));
      setCampaigns([]);
    }
  }, [t]);

  useEffect(() => {
    if (!open) return;
    if (campaigns !== null) return;
    // Defer the fetch trigger to a microtask so the state-setters
    // inside loadCampaigns() never run synchronously inside this
    // effect body — keeps react-hooks/set-state-in-effect happy.
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      void loadCampaigns();
    });
    return () => {
      cancelled = true;
    };
  }, [open, campaigns, loadCampaigns]);

  async function onSubmit(): Promise<void> {
    if (!campaignId) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/kols/bulk`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kolIds: selectedIds }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "request_failed");
      }
      const result = (await res.json()) as BulkAddResult;
      onAdded(result);
      onOpenChange(false);
    } catch (err) {
      console.error("[AddToCampaignDialog] submit failed", err);
      setError(t("errorGeneric"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPanel data-testid="add-to-campaign-dialog">
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-on-surface-variant">
            {t("body", { count: selectedIds.length })}
          </p>
          {loading ? (
            <p className="mt-4 text-sm text-on-surface-variant">{t("loading")}</p>
          ) : campaigns && campaigns.length === 0 ? (
            <p className="mt-4 text-sm text-on-surface-variant">{t("noCampaigns")}</p>
          ) : (
            <div className="mt-4 space-y-2">
              <label
                htmlFor="add-to-campaign-select"
                className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant"
              >
                {t("chooseCampaign")}
              </label>
              <Select
                id="add-to-campaign-select"
                value={campaignId}
                onChange={(e) => setCampaignId(e.currentTarget.value)}
                data-testid="add-to-campaign-select"
              >
                {(campaigns ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.status !== "active" ? ` (${c.status})` : ""}
                  </option>
                ))}
              </Select>
            </div>
          )}
          {error ? (
            <p className="mt-3 text-xs text-error" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              {t("cancel")}
            </Button>
            <Button
              variant="primary-gradient"
              onClick={onSubmit}
              disabled={submitting || loading || !campaignId}
              data-testid="add-to-campaign-submit"
            >
              {submitting ? t("submitting") : t("submit")}
            </Button>
          </DialogFooter>
        </DialogPanel>
      </DialogPortal>
    </Dialog>
  );
}

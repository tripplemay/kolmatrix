"use client";

/**
 * BL-065-F003 · Destructive bulk soft-delete confirmation modal.
 *
 * Spec §F003 decision-point #D Planner-tilt: "保留全部 + 加确认 modal".
 * Soft-delete is the gentlest bulk action, but it still removes rows
 * from the workbench until an admin restores them — friction at the
 * UI layer prevents accidental clicks.
 *
 * Calls `useTranslations` directly so the body string's {count} ICU
 * placeholder binds to the live selection length (BM2 F011 lesson —
 * pre-formatted strings cross the RSC boundary, callbacks do not).
 */
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  Button,
  Dialog,
  DialogBackdrop,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPortal,
  DialogTitle,
} from "@/components/ui";

import { bulkSoftDeleteKolsAction } from "./actions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  onDeleted: (count: number) => void;
}

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  selectedIds,
  onDeleted,
}: Props) {
  const t = useTranslations("match.bulk.confirmDelete");
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onConfirm(): Promise<void> {
    if (selectedIds.length === 0) return;
    setSubmitting(true);
    setError(null);
    const result = await bulkSoftDeleteKolsAction({ kolIds: selectedIds });
    setSubmitting(false);
    if (!result.ok) {
      setError(
        result.error === "rate_limit_exceeded"
          ? t("errorRateLimit")
          : t("errorGeneric"),
      );
      return;
    }
    onDeleted(result.deleted);
    onOpenChange(false);
    router.refresh();
  }

  function handleOpenChange(next: boolean) {
    if (submitting) return;
    onOpenChange(next);
    if (!next) setError(null);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPanel size="sm" data-testid="match-confirm-delete-dialog">
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
          </DialogHeader>
          <p className="px-5 py-4 text-sm text-on-surface-variant">
            {t("body", { count: selectedIds.length })}
          </p>
          {error ? (
            <p
              role="alert"
              className="mx-5 mb-4 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200"
              data-testid="match-confirm-delete-error"
            >
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={submitting}
              data-testid="match-confirm-delete-cancel"
            >
              {t("cancel")}
            </Button>
            <Button
              variant="danger"
              onClick={onConfirm}
              disabled={submitting || selectedIds.length === 0}
              data-testid="match-confirm-delete-submit"
            >
              {submitting ? t("submitting") : t("confirm")}
            </Button>
          </DialogFooter>
        </DialogPanel>
      </DialogPortal>
    </Dialog>
  );
}

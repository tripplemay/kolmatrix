/**
 * BM2-F010 · Brand-header client buttons (Download PDF / Share /
 * Regenerate). Scoped client component so the brand-header server
 * component can stay async-friendly.
 *
 * - Download PDF: sets `document.title` (Planner §13.5 #5) and calls
 *   `window.print()`. Print stylesheet does the rest.
 * - Share: calls `createShareTokenAction`, copies URL to clipboard,
 *   shows a toast.
 * - Regenerate: re-runs `generateWeeklyReportAction` for the same
 *   weekStart/locale; UI navigates back to the same page after.
 */
"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

import {
  createShareTokenAction,
  generateWeeklyReportAction,
  revokeShareTokenAction,
} from "./actions";

// BL-051a-F005 — TTL choices the user picks before minting a share
// link. Mirrors `ShareTokenTtlChoice` in persistence.ts; kept as a
// const tuple so the runtime stringifies match the server-side
// parser.
export const SHARE_TTL_CHOICES = ["1", "7", "30", "never"] as const;
export type ShareTtlValue = (typeof SHARE_TTL_CHOICES)[number];

export interface ShareTokenMetadata {
  hasToken: boolean;
  expiresAtIso: string | null;
  revokedAtIso: string | null;
  creatorName: string | null;
}

export interface ShareTtlLabels {
  picker: string;
  oneDay: string;
  sevenDays: string;
  thirtyDays: string;
  never: string;
}

export interface RevokeLabels {
  button: string;
  confirm: string;
  toastSuccess: string;
  toastError: string;
}

export interface ShareMetadataLabels {
  expiresLabel: string;
  expiresNever: string;
  createdByLabel: string;
  revokedLabel: string;
}

interface Props {
  reportId: string;
  tenantName: string;
  weekStartIso: string;
  locale: "en" | "zh";
  downloadPdfLabel: string;
  /** Tooltip + toast strings for the PDF download flow (BIx F002 P1-8a). */
  downloadPdfTooltip: string;
  downloadPdfToast: string;
  shareLabel: string;
  regenerateLabel: string;
  /** "{0}" placeholder for the URL, "{1}" placeholder for expiry. */
  shareToastSuccessTemplate: string;
  shareToastErrorTemplate: string;
  // BL-051a-F005 props
  shareMetadata: ShareTokenMetadata;
  ttlLabels: ShareTtlLabels;
  revokeLabels: RevokeLabels;
  shareMetadataLabels: ShareMetadataLabels;
}

interface Toast {
  tone: "success" | "error";
  message: string;
}

function safeFilenameFragment(s: string): string {
  return s.replace(/[^a-z0-9]/gi, "_").slice(0, 40);
}

export function WeeklyReportClientActions({
  reportId,
  tenantName,
  weekStartIso,
  locale,
  downloadPdfLabel,
  downloadPdfTooltip,
  downloadPdfToast,
  shareLabel,
  regenerateLabel,
  shareToastSuccessTemplate,
  shareToastErrorTemplate,
  shareMetadata,
  ttlLabels,
  revokeLabels,
  shareMetadataLabels,
}: Props) {
  const router = useRouter();
  const [isSharing, startShareTransition] = useTransition();
  const [isRegenerating, startRegenerateTransition] = useTransition();
  const [isRevoking, startRevokeTransition] = useTransition();
  const [toast, setToast] = useState<Toast | null>(null);
  const [ttl, setTtl] = useState<ShareTtlValue>("7");

  const handleDownload = useCallback(() => {
    const original = document.title;
    document.title = `WeeklyReport_${safeFilenameFragment(tenantName)}_${weekStartIso.replace(/-/g, "")}`;
    // verifying-2026-05-01-round-2 fix C-13: dispatch a synthetic
    // event right before window.print(). Headless Chromium does not
    // fire `beforeprint` for `window.print()` reliably, so Reviewer's
    // prod L2 round-2 verification couldn't confirm the click did
    // anything. Listening for `kolmatrix:weekly-report-download`
    // gives both Playwright and onlookers a deterministic signal
    // that the handler ran without changing the user-visible flow.
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("kolmatrix:weekly-report-download"));
    }
    // BIx-mvp-polish-pass F002 P1-8a — surface a toast that explains
    // the print-dialog → "Save as PDF" path. Browser print dialogs
    // are jurisdiction-/OS-dependent so we can't guarantee a Save-as-PDF
    // shortcut, but this nudges the user away from the "did anything
    // happen?" confusion the audit flagged.
    setToast({ tone: "success", message: downloadPdfToast });
    window.print();
    // Restore the original title after the print dialog closes.
    setTimeout(() => {
      document.title = original;
    }, 1_000);
  }, [tenantName, weekStartIso, downloadPdfToast]);

  const handleShare = useCallback(() => {
    setToast(null);
    startShareTransition(async () => {
      // BL-035-F004: origin is now derived server-side; client no
      // longer trusted to supply it.
      // BL-051a-F005: ttl pulled from the dropdown; server falls back
      // to the legacy 7-day default if anything other than
      // 1/7/30/never reaches it.
      const res = await createShareTokenAction(reportId, ttl);
      if (!res.ok) {
        setToast({ tone: "error", message: shareToastErrorTemplate });
        return;
      }
      try {
        await navigator.clipboard.writeText(res.url);
      } catch {
        // Clipboard may be unavailable (insecure context, headless tests).
      }
      const message = shareToastSuccessTemplate
        .replace("{0}", res.url)
        .replace(
          "{1}",
          ttl === "never"
            ? shareMetadataLabels.expiresNever
            : new Date(res.expiresAt).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US")
        );
      setToast({ tone: "success", message });
      router.refresh();
    });
  }, [
    reportId,
    ttl,
    shareToastSuccessTemplate,
    shareToastErrorTemplate,
    shareMetadataLabels.expiresNever,
    locale,
    router,
  ]);

  const handleRevoke = useCallback(() => {
    setToast(null);
    if (!window.confirm(revokeLabels.confirm)) return;
    startRevokeTransition(async () => {
      const res = await revokeShareTokenAction(reportId);
      if (!res.ok) {
        setToast({ tone: "error", message: revokeLabels.toastError });
        return;
      }
      setToast({ tone: "success", message: revokeLabels.toastSuccess });
      router.refresh();
    });
  }, [reportId, revokeLabels.confirm, revokeLabels.toastError, revokeLabels.toastSuccess, router]);

  const handleRegenerate = useCallback(() => {
    setToast(null);
    startRegenerateTransition(async () => {
      const res = await generateWeeklyReportAction(weekStartIso, locale);
      if (!res.ok) {
        setToast({ tone: "error", message: shareToastErrorTemplate });
        return;
      }
      router.refresh();
    });
  }, [weekStartIso, locale, router, shareToastErrorTemplate]);

  // BL-051a-F005 — when a live token exists, the share row swaps from
  // "mint a new link" controls to a metadata strip + Revoke. We keep
  // both blocks here (instead of two siblings in the brand header)
  // so the toast/transition state stays co-located.
  const hasLiveToken =
    shareMetadata.hasToken && shareMetadata.revokedAtIso === null;
  const wasRevoked =
    shareMetadata.hasToken && shareMetadata.revokedAtIso !== null;
  const intlLocale = locale === "zh" ? "zh-CN" : "en-US";
  const expiresDisplay = (() => {
    if (!shareMetadata.expiresAtIso) return null;
    const d = new Date(shareMetadata.expiresAtIso);
    // Far-future sentinel (>= year 9000) renders as "never" so spec
    // D4's intent — the user-visible "永久" / "Never expires" — is
    // preserved even though the column is non-null.
    if (d.getUTCFullYear() >= 9000) return shareMetadataLabels.expiresNever;
    return d.toLocaleDateString(intlLocale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  })();
  const revokedDisplay = shareMetadata.revokedAtIso
    ? new Date(shareMetadata.revokedAtIso).toLocaleDateString(intlLocale, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <>
      <button
        type="button"
        onClick={handleDownload}
        title={downloadPdfTooltip}
        data-testid="weekly-report-download-pdf"
        className="text-on-primary flex items-center gap-2 rounded-xl bg-gradient-to-br from-[#00daf3] to-[#c3f5ff] px-5 py-2.5 text-xs font-bold"
      >
        <span aria-hidden className="material-symbols-outlined text-[18px]">
          download
        </span>
        {downloadPdfLabel}
      </button>
      {hasLiveToken ? (
        <div
          data-testid="weekly-report-share-metadata"
          className="bg-surface-container-high/70 text-on-surface flex flex-col gap-1 rounded-xl px-3 py-2 text-[11px]"
        >
          <span>
            <strong className="font-semibold">
              {shareMetadataLabels.expiresLabel}:
            </strong>{" "}
            {expiresDisplay}
          </span>
          {shareMetadata.creatorName ? (
            <span className="text-on-surface-variant">
              {shareMetadataLabels.createdByLabel}: {shareMetadata.creatorName}
            </span>
          ) : null}
          <button
            type="button"
            onClick={handleRevoke}
            disabled={isRevoking}
            data-testid="weekly-report-revoke"
            className="border-error/40 text-error hover:bg-error/10 mt-1 inline-flex items-center gap-1 self-start rounded-lg border px-2 py-1 text-[11px] font-bold disabled:cursor-progress disabled:opacity-60"
          >
            <span aria-hidden className="material-symbols-outlined text-[14px]">
              block
            </span>
            {revokeLabels.button}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <label
            data-testid="weekly-report-ttl-picker"
            className="bg-surface-container-high/70 text-on-surface flex items-center gap-1 rounded-xl px-2 py-1.5 text-[11px]"
          >
            <span className="text-on-surface-variant">{ttlLabels.picker}</span>
            <select
              value={ttl}
              onChange={(e) => setTtl(e.target.value as ShareTtlValue)}
              data-testid="weekly-report-ttl-select"
              className="bg-transparent text-xs font-bold outline-none"
            >
              <option value="1">{ttlLabels.oneDay}</option>
              <option value="7">{ttlLabels.sevenDays}</option>
              <option value="30">{ttlLabels.thirtyDays}</option>
              <option value="never">{ttlLabels.never}</option>
            </select>
          </label>
          <button
            type="button"
            onClick={handleShare}
            disabled={isSharing}
            data-testid="weekly-report-share"
            className="bg-surface-container-high/70 text-on-surface hover:bg-surface-container-high flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold disabled:cursor-progress disabled:opacity-60"
          >
            <span aria-hidden className="material-symbols-outlined text-[18px]">
              share
            </span>
            {shareLabel}
          </button>
        </div>
      )}
      {wasRevoked ? (
        <span
          data-testid="weekly-report-share-revoked"
          className="border-on-surface-variant/30 text-on-surface-variant rounded-xl border px-3 py-2 text-[11px] italic"
        >
          {shareMetadataLabels.revokedLabel}: {revokedDisplay}
        </span>
      ) : null}
      <button
        type="button"
        onClick={handleRegenerate}
        disabled={isRegenerating}
        data-testid="weekly-report-regenerate"
        className="bg-surface-container-high/70 text-on-surface hover:bg-surface-container-high flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold disabled:cursor-progress disabled:opacity-60"
      >
        <span aria-hidden className="material-symbols-outlined text-[18px]">
          autorenew
        </span>
        {regenerateLabel}
      </button>
      {toast ? (
        <div
          role="status"
          data-testid="weekly-report-toast"
          data-tone={toast.tone}
          className={`absolute top-20 right-4 max-w-md rounded-xl border px-4 py-3 text-xs ${
            toast.tone === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              : "border-error/30 bg-error/10 text-error"
          }`}
        >
          {toast.message}
        </div>
      ) : null}
    </>
  );
}

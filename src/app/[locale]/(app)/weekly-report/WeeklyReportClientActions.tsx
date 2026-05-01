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
} from "./actions";

interface Props {
  reportId: string;
  tenantName: string;
  weekStartIso: string;
  locale: "en" | "zh";
  downloadPdfLabel: string;
  shareLabel: string;
  regenerateLabel: string;
  /** "{0}" placeholder for the URL, "{1}" placeholder for expiry. */
  shareToastSuccessTemplate: string;
  shareToastErrorTemplate: string;
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
  shareLabel,
  regenerateLabel,
  shareToastSuccessTemplate,
  shareToastErrorTemplate,
}: Props) {
  const router = useRouter();
  const [isSharing, startShareTransition] = useTransition();
  const [isRegenerating, startRegenerateTransition] = useTransition();
  const [toast, setToast] = useState<Toast | null>(null);

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
    window.print();
    // Restore the original title after the print dialog closes.
    setTimeout(() => {
      document.title = original;
    }, 1_000);
  }, [tenantName, weekStartIso]);

  const handleShare = useCallback(() => {
    setToast(null);
    startShareTransition(async () => {
      const res = await createShareTokenAction(reportId, window.location.origin);
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
          new Date(res.expiresAt).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US")
        );
      setToast({ tone: "success", message });
    });
  }, [reportId, shareToastSuccessTemplate, shareToastErrorTemplate, locale]);

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

  return (
    <>
      <button
        type="button"
        onClick={handleDownload}
        data-testid="weekly-report-download-pdf"
        className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-[#00daf3] to-[#c3f5ff] px-5 py-2.5 text-xs font-bold text-on-primary"
      >
        <span aria-hidden className="material-symbols-outlined text-[18px]">
          download
        </span>
        {downloadPdfLabel}
      </button>
      <button
        type="button"
        onClick={handleShare}
        disabled={isSharing}
        data-testid="weekly-report-share"
        className="flex items-center gap-2 rounded-xl bg-surface-container-high/70 px-3 py-2 text-xs font-bold text-on-surface hover:bg-surface-container-high disabled:cursor-progress disabled:opacity-60"
      >
        <span aria-hidden className="material-symbols-outlined text-[18px]">
          share
        </span>
        {shareLabel}
      </button>
      <button
        type="button"
        onClick={handleRegenerate}
        disabled={isRegenerating}
        data-testid="weekly-report-regenerate"
        className="flex items-center gap-2 rounded-xl bg-surface-container-high/70 px-3 py-2 text-xs font-bold text-on-surface hover:bg-surface-container-high disabled:cursor-progress disabled:opacity-60"
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
          className={`absolute right-4 top-20 max-w-md rounded-xl border px-4 py-3 text-xs ${
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

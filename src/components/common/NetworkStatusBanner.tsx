/**
 * BL-052 F007 — NetworkStatusBanner.
 *
 * Top-of-viewport bar wired into (app)/layout.tsx so all 11 main
 * pages get the T (timeout / network) edge state for free. Two
 * visible states:
 *   - offline       : red bar, "You are offline. Reconnecting..."
 *                     stays as long as navigator.onLine === false.
 *   - back-online   : amber/cyan toast, "Back online", auto-dismisses
 *                     after RESTORED_VISIBLE_MS so the user can see
 *                     the connection recovered without a stuck banner.
 *
 * Hidden when the page first loads while online and no offline event
 * has ever fired (clean state, no DOM noise).
 */
"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { cn } from "@/lib/utils";

const RESTORED_VISIBLE_MS = 2000;

export function NetworkStatusBanner() {
  const { isOnline, lastOfflineAt } = useNetworkStatus();
  const t = useTranslations("common.network");
  const [showRestored, setShowRestored] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setShowRestored(false);
      return;
    }
    if (lastOfflineAt) {
      setShowRestored(true);
      const t = setTimeout(() => setShowRestored(false), RESTORED_VISIBLE_MS);
      return () => clearTimeout(t);
    }
  }, [isOnline, lastOfflineAt]);

  if (isOnline && !showRestored) return null;

  const offline = !isOnline;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="network-status-banner"
      data-state={offline ? "offline" : "back-online"}
      className={cn(
        "fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 px-4 py-2 text-center text-sm font-medium",
        offline
          ? "bg-red-500/90 text-white"
          : "bg-emerald-500/90 text-emerald-950"
      )}
    >
      <span className="material-symbols-outlined text-base" aria-hidden>
        {offline ? "wifi_off" : "wifi"}
      </span>
      <span>{offline ? t("offline") : t("backOnline")}</span>
    </div>
  );
}

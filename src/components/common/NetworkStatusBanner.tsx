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

  // The "Back online" toast appears for RESTORED_VISIBLE_MS after a
  // false→true transition of `isOnline`. We only flip `showRestored`
  // inside async timer callbacks (never synchronously inside the
  // effect body) so eslint-react-hooks/set-state-in-effect stays
  // happy. The setTimeout(_, 0) for the show step ensures cleanup of
  // the previous run completes before this run schedules a new one.
  useEffect(() => {
    if (!isOnline || !lastOfflineAt) return;
    const showId = setTimeout(() => setShowRestored(true), 0);
    const hideId = setTimeout(() => setShowRestored(false), RESTORED_VISIBLE_MS);
    return () => {
      clearTimeout(showId);
      clearTimeout(hideId);
    };
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

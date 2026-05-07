/**
 * BL-052 F007 — `useNetworkStatus`.
 *
 * Wraps the browser online/offline events and exposes:
 *   - isOnline       : boolean (initial value `navigator.onLine` if
 *                      available; SSR + early-tree renders default to
 *                      `true` so the banner doesn't flash on hydrate.)
 *   - lastOfflineAt  : Date | null — set when the browser fires an
 *                      "offline" event; reset to null when "online"
 *                      arrives. NetworkStatusBanner uses it to keep
 *                      the "Back online" toast visible briefly even
 *                      after the connection is restored.
 *
 * Pure client hook — never triggers data fetching.
 */
"use client";

import { useEffect, useState } from "react";

export interface NetworkStatus {
  isOnline: boolean;
  lastOfflineAt: Date | null;
}

function readInitial(): { isOnline: boolean; lastOfflineAt: Date | null } {
  if (typeof navigator === "undefined") {
    return { isOnline: true, lastOfflineAt: null };
  }
  // navigator.onLine returns false ONLY when the browser has no
  // connection at all (cable unplugged / wifi off). Captive-portal
  // and DNS-failure cases still report true; that's the platform
  // contract — UI here mirrors browser truth. The lazy useState
  // initializer runs once on first client render so a page hydrated
  // while offline starts in the offline branch immediately, with no
  // post-mount setState (which would trip react-hooks/set-state-in-effect).
  if (navigator.onLine) return { isOnline: true, lastOfflineAt: null };
  return { isOnline: false, lastOfflineAt: new Date() };
}

export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState(() => readInitial().isOnline);
  const [lastOfflineAt, setLastOfflineAt] = useState<Date | null>(
    () => readInitial().lastOfflineAt
  );

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Banner uses the timestamp gap (now - lastOfflineAt) to drive
      // the 2s "Back online" toast — leave it set so consumers can
      // diff it for transition behavior.
    };
    const handleOffline = () => {
      setIsOnline(false);
      setLastOfflineAt(new Date());
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return { isOnline, lastOfflineAt };
}

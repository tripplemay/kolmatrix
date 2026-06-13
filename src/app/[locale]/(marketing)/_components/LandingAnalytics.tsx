"use client";

import { useEffect } from "react";

import { captureUtm, sendLandingEvent } from "./landing-attribution";

/**
 * BL-115-F001 — mounts once on the landing page and wires the ad-funnel
 * 埋点: persists UTM, then beacons page_view / scroll_depth (25·50·75·100) /
 * cta_click (delegated on [data-analytics-cta]) / section_dwell (first view
 * of [data-analytics-section]). All fire-and-forget; renders nothing.
 */
export function LandingAnalytics() {
  useEffect(() => {
    captureUtm();
    sendLandingEvent("page_view", { path: window.location.pathname });

    const firedDepths = new Set<number>();
    const onScroll = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      if (max <= 0) return;
      const pct = Math.round((doc.scrollTop / max) * 100);
      for (const t of [25, 50, 75, 100]) {
        if (pct >= t && !firedDepths.has(t)) {
          firedDepths.add(t);
          sendLandingEvent("scroll_depth", { depth: t });
        }
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest("[data-analytics-cta]");
      if (el) sendLandingEvent("cta_click", { cta: el.getAttribute("data-analytics-cta") });
    };
    document.addEventListener("click", onClick);

    const seen = new Set<string>();
    let observer: IntersectionObserver | undefined;
    if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const name = entry.target.getAttribute("data-analytics-section");
            if (entry.isIntersecting && name && !seen.has(name)) {
              seen.add(name);
              sendLandingEvent("section_dwell", { section: name });
            }
          }
        },
        { threshold: 0.4 },
      );
      document
        .querySelectorAll("[data-analytics-section]")
        .forEach((el) => observer!.observe(el));
    }

    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("click", onClick);
      observer?.disconnect();
    };
  }, []);

  return null;
}

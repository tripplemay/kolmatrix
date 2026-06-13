"use client";

/**
 * BL-115-F001 — client-side ad-funnel attribution + analytics beacons.
 *
 * - `captureUtm()` persists URL utm_* params into a 30-day cookie so a
 *   conversion that happens after navigation keeps its source attribution.
 * - `readAttribution()` merges URL > cookie utm + referrer + landing path
 *   for the trial form's hidden fields.
 * - `sendLandingEvent()` fires a fire-and-forget beacon to
 *   /api/landing-event (sendBeacon, fetch keepalive fallback).
 */
const UTM_COOKIE = "kqlm_attribution";
const UTM_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;
const MAX_LEN = 128;

export interface Attribution {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  referrer?: string;
  landingPath?: string;
}

export function captureUtm(): void {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  for (const k of UTM_PARAMS) {
    const v = params.get(k);
    if (v) utm[k] = v.slice(0, MAX_LEN);
  }
  // Don't clobber an earlier attribution with an empty (utm-less) visit.
  if (Object.keys(utm).length === 0) return;
  try {
    document.cookie = `${UTM_COOKIE}=${encodeURIComponent(JSON.stringify(utm))}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
  } catch {
    /* cookies disabled — attribution best-effort only */
  }
}

function readCookieUtm(): Record<string, string> {
  if (typeof document === "undefined") return {};
  const hit = document.cookie.split("; ").find((c) => c.startsWith(`${UTM_COOKIE}=`));
  if (!hit) return {};
  try {
    return JSON.parse(decodeURIComponent(hit.slice(UTM_COOKIE.length + 1))) as Record<string, string>;
  } catch {
    return {};
  }
}

export function readAttribution(): Attribution {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const cookieUtm = readCookieUtm();
  const pick = (k: string) => params.get(k) ?? cookieUtm[k] ?? undefined;
  return {
    utmSource: pick("utm_source"),
    utmMedium: pick("utm_medium"),
    utmCampaign: pick("utm_campaign"),
    utmTerm: pick("utm_term"),
    utmContent: pick("utm_content"),
    referrer: document.referrer || undefined,
    landingPath: window.location.pathname || undefined,
  };
}

export function sendLandingEvent(type: string, payload?: Record<string, unknown>): void {
  if (typeof navigator === "undefined") return;
  const body = JSON.stringify({ type, payload: payload ?? {} });
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/landing-event", new Blob([body], { type: "application/json" }));
      return;
    }
  } catch {
    /* fall through to fetch */
  }
  try {
    void fetch("/api/landing-event", {
      method: "POST",
      body,
      keepalive: true,
      headers: { "content-type": "application/json" },
    });
  } catch {
    /* analytics is never load-bearing */
  }
}

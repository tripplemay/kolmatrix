import type { NextRequest } from "next/server";

import { logEvent } from "@/lib/events/log";

/**
 * BL-115-F001 — anonymous landing-page analytics sink (ad-funnel 埋点).
 *
 * The marketing page beacons funnel events here (sendBeacon → text body).
 * They land in `event_log` as platform-level rows (tenantId null) via the
 * fire-and-forget logEvent. Type is allow-listed so the public endpoint
 * can't write arbitrary event names; payload is size-capped. Always 204 —
 * analytics is never load-bearing and we don't leak state to the client.
 */
const ALLOWED_TYPES = new Set([
  "page_view",
  "cta_click",
  "form_open",
  "form_submit",
  "scroll_depth",
  "section_dwell",
]);

const MAX_BODY_BYTES = 2000;

export async function POST(req: NextRequest): Promise<Response> {
  const text = await req.text().catch(() => "");
  if (!text || text.length > MAX_BODY_BYTES) {
    return new Response(null, { status: 204 });
  }

  let body: { type?: unknown; payload?: unknown } = {};
  try {
    body = JSON.parse(text);
  } catch {
    return new Response(null, { status: 204 });
  }

  const type = typeof body.type === "string" ? body.type : "";
  if (!ALLOWED_TYPES.has(type)) {
    return new Response(null, { status: 204 });
  }

  const payload =
    body.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
      ? (body.payload as Record<string, unknown>)
      : {};

  await logEvent({ type: `landing.${type}`, payload });

  return new Response(null, { status: 204 });
}

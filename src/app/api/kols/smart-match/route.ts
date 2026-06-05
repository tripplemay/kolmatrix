/**
 * B7a-F002 · POST /api/kols/smart-match
 *
 * Body: { productId: string }
 * Response: { product, results: [{...}, ...], durationMs }
 *
 * Auth: session-gated, tenant-scoped (RLS narrows the cosine query to
 * the caller's KOL set). Anonymous → 401.
 *
 * Telemetry: emits `smart_match.invoked` with product id, top-K size,
 * latency, and JIT-embed flag. Failures are not double-logged here —
 * runSmartMatch already throws SmartMatchError with a recognisable
 * code; we just translate to HTTP.
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import {
  runSmartMatch,
  SmartMatchError,
} from "@/lib/discovery/smart-match";
import { rateLimitAi } from "@/lib/rate-limit-ai";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  productId: z.string().min(1),
  topK: z.number().int().min(1).max(50).optional(),
});

export async function POST(req: Request): Promise<NextResponse> {
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  const userId = session?.user?.id;
  if (!tenantId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "validation_failed",
        issues: parsed.error.issues.map((i) => ({
          path: i.path,
          message: i.message,
        })),
      },
      { status: 400 }
    );
  }

  // BL-035-F003: per-tenant AI rate limit (10/min + 100/day). 429 with
  // Retry-After lets clients back off cleanly.
  const rl = await rateLimitAi(tenantId);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate_limit_exceeded", retryAfter: rl.retryAfter },
      {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfter) },
      },
    );
  }

  try {
    // BL-084-F001: `smart_match.invoked` telemetry now fires inside
    // runSmartMatch (single emitter, carries campaignId when present), so
    // we just thread the actor through and no longer log here.
    const result = await runSmartMatch({
      tenantId,
      productId: parsed.data.productId,
      topK: parsed.data.topK,
      actorId: userId,
    });

    return NextResponse.json(result, {
      headers: { "cache-control": "no-store" },
    });
  } catch (err) {
    if (err instanceof SmartMatchError) {
      if (err.code === "product_not_found") {
        return NextResponse.json(
          { error: "product_not_found" },
          { status: 404 }
        );
      }
      if (err.code === "embedding_failed") {
        return NextResponse.json(
          { error: "embedding_failed", detail: err.message },
          { status: 503 }
        );
      }
    }
    console.error("[smart-match] unexpected error:", err);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
}

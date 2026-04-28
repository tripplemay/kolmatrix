/**
 * B7a-F001 · `embedding.invoked` event_log emitter.
 *
 * Audit lock acceptance — emit one event_log row per batch with
 * payload covering tokens, cost, batch counts, and source. Used for
 * cost monitoring + future Smart Match telemetry.
 *
 * Fire-and-forget: if the insert fails (e.g. cron prisma client lacks
 * permissions on the unscoped event_log table), we swallow the error.
 * Embedding events are observability-only, never load-bearing.
 */
import type { Prisma, PrismaClient } from "@prisma/client";

import type { EmbedRunStats } from "./kol-embed";

/** Where the embedding call originated (helps cost-by-source slicing). */
export type EmbeddingInvokedSource =
  | "one-time-backfill"
  | "b6-daily-hook"
  | "product-jit"
  | "smart-match-query";

export interface EmbeddingInvokedPayload {
  source: EmbeddingInvokedSource;
  scanned: number;
  skipped: number;
  embedded: number;
  failed: number;
  batches: number;
  promptTokens: number;
  estimatedCostUsd: number;
  /** Optional KOL/Product ID this run targeted (only when scoped). */
  resourceId?: string;
}

export async function logEmbeddingInvoked(
  prisma: PrismaClient,
  source: EmbeddingInvokedSource,
  stats: EmbedRunStats,
  resourceId?: string
): Promise<void> {
  // Skip the write entirely when nothing happened — useful events only.
  if (stats.embedded === 0 && stats.failed === 0) return;

  const payload: EmbeddingInvokedPayload = {
    source,
    scanned: stats.scanned,
    skipped: stats.skipped,
    embedded: stats.embedded,
    failed: stats.failed,
    batches: stats.batches,
    promptTokens: stats.promptTokens,
    estimatedCostUsd: stats.estimatedCostUsd,
    resourceId,
  };

  try {
    await prisma.eventLog.create({
      data: {
        type: "embedding.invoked",
        tenantId: null, // cron / platform-level event
        actorId: null,
        resourceId,
        payload: payload as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    console.warn(
      `[embedding.invoked] event_log write failed: ${(err as Error).message}`
    );
  }
}

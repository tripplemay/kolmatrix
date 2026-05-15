"use server";

/**
 * BL-067-F005 · Server action that enqueues a short-explanation pre-warm
 * job for a (tenant, campaign, top-30 kolIds) batch. Called from
 * AiRecommendationPanel on mount after smart-match returns its top 30.
 *
 * Fire-and-forget pattern (per F001 audit §4:B): the action awaits the
 * `jobQueue.add(...)` call which only registers a setTimeout(1) and
 * returns the jobId immediately — the actual LLM work happens on the
 * next tick so the server action does not block the panel mount.
 *
 * Idempotent via `prewarm-{tenantId}-{campaignId}` jobId: same tuple
 * enqueued twice within the process lifetime returns the original jobId
 * without re-firing the handler. Process restart clears the idempotency
 * map, which is the self-heal mechanism we accept in lieu of BullMQ
 * persistence (per audit §4:B trade-off).
 */
import { auth } from "@/auth";
import { jobQueue } from "@/lib/jobs/queue";
import {
  EXPLAIN_PREWARM_JOB,
  type ExplainPrewarmPayload,
} from "@/lib/queue/explain-recommendations-worker";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_KOL_IDS = 60;

export type EnqueuePrewarmActionError =
  | "unauthorized"
  | "validation_failed";

export interface EnqueueExplanationPrewarmInput {
  campaignId: string;
  kolIds: string[];
}

export type EnqueueExplanationPrewarmResult =
  | { ok: true; jobId: string; deduped?: boolean }
  | { ok: false; error: EnqueuePrewarmActionError };

export async function enqueueExplanationPrewarmAction(
  input: EnqueueExplanationPrewarmInput,
): Promise<EnqueueExplanationPrewarmResult> {
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  if (!tenantId || !UUID_RE.test(tenantId)) {
    return { ok: false, error: "unauthorized" };
  }
  if (!UUID_RE.test(input.campaignId)) {
    return { ok: false, error: "validation_failed" };
  }
  if (!Array.isArray(input.kolIds)) {
    return { ok: false, error: "validation_failed" };
  }
  // Empty array is a valid noop (mount before smart-match returns).
  if (input.kolIds.length === 0) {
    return { ok: true, jobId: "" };
  }
  if (input.kolIds.length > MAX_KOL_IDS) {
    return { ok: false, error: "validation_failed" };
  }
  for (const id of input.kolIds) {
    if (!UUID_RE.test(id)) {
      return { ok: false, error: "validation_failed" };
    }
  }

  const payload: ExplainPrewarmPayload = {
    tenantId,
    campaignId: input.campaignId,
    kolIds: input.kolIds,
  };

  const { jobId } = await jobQueue.add<ExplainPrewarmPayload>(
    EXPLAIN_PREWARM_JOB,
    payload,
    {
      // Same-process idempotency: re-enqueue with the same key returns
      // the original jobId without firing the handler twice.
      idempotencyKey: `prewarm-${tenantId}-${input.campaignId}`,
      // delay=1 ms → InMemoryJobQueue uses setTimeout, so add() returns
      // immediately without running the handler on this turn. Server
      // action stays under ~10ms even when the worker takes seconds.
      delay: 1,
      tenantId,
    },
  );

  return { ok: true, jobId };
}

/**
 * BL-100-F003 (ADR-020 D3) — send-email-batch job handler.
 *
 * One enqueued job == one outreach batch. The handler runs the existing
 * `batchSendOutreach` inside the worker WITH the throttle sleep enabled
 * (`skipSleep: false`) — that 6s/email pacing is exactly what we moved
 * off the request path, so it belongs here. `batchSendOutreach` is
 * idempotent by (batchId, kolId) (F002 D4), so a BullMQ retry re-runs the
 * handler without double-sending.
 *
 * Registered into the process-wide jobQueue singleton at boot via
 * src/lib/jobs/handlers/register.ts (imported by instrumentation.ts), so
 * the same in-process worker pattern that backs prewarm consumes these
 * jobs too — no separate pm2 daemon (ADR-020 D2).
 */
import { jobQueue } from "@/lib/jobs/queue";

import { batchSendOutreach, type BatchSendItem } from "./batch-send";

export const SEND_EMAIL_BATCH_JOB = "send-email-batch";

export interface SendEmailBatchPayload {
  tenantId: string;
  userId: string;
  campaignId: string;
  items: BatchSendItem[];
  batchId: string;
}

export async function processSendEmailBatch(
  payload: SendEmailBatchPayload,
): Promise<void> {
  await batchSendOutreach(
    payload.tenantId,
    payload.userId,
    payload.campaignId,
    payload.items,
    payload.batchId,
    { skipSleep: false },
  );
}

export function registerSendEmailBatchHandler(): void {
  jobQueue.register<SendEmailBatchPayload>(SEND_EMAIL_BATCH_JOB, (payload) =>
    processSendEmailBatch(payload),
  );
}

// Central handler registration. BM1 / BM2 features hang their async
// job handlers off this module; src/instrumentation.ts imports it once
// at process boot so registrations are in place before the first add().

// BL-067-F005 · short-explanation pre-warm worker. Idempotency key
// `prewarm-{tenantId}-{campaignId}` keeps re-mount within the same
// process from re-triggering the LLM batch.
import { registerExplainPrewarmHandler } from "@/lib/queue/explain-recommendations-worker";
// BL-100-F003 · outreach send-email-batch worker. Consumes the jobs that
// sendBatchAction enqueues so the throttled send runs off the request
// path; idempotent by (batchId, kolId) for safe BullMQ retries.
import { registerSendEmailBatchHandler } from "@/lib/email/send-batch-worker";

registerExplainPrewarmHandler();
registerSendEmailBatchHandler();

export {};

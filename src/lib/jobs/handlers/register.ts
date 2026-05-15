// Central handler registration. BM1 / BM2 features hang their async
// job handlers off this module; src/instrumentation.ts imports it once
// at process boot so registrations are in place before the first add().
//
// Example shape (left empty for MVP — BM2 email sending will populate):
//
//   import { jobQueue } from "@/lib/jobs/queue";
//   jobQueue.register<SendEmailPayload>("send-email", async (payload, ctx) => {
//     await sendWithResend(payload);
//   });

// BL-067-F005 · short-explanation pre-warm worker. Idempotency key
// `prewarm-{tenantId}-{campaignId}` keeps re-mount within the same
// process from re-triggering the LLM batch.
import { registerExplainPrewarmHandler } from "@/lib/queue/explain-recommendations-worker";

registerExplainPrewarmHandler();

export {};

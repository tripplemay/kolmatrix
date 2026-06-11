-- BL-100-F002 (ADR-020 D3/D4) — associate email_log rows with the async
-- send batch + index for the progress poll / idempotency guard.
--
-- batch_id is the uuid sendBatchAction generates before enqueuing the
-- send-email-batch job. It is written by batch-send for every attempt so
-- getSendBatchStatus(batchId) can count {sent,failed,mock_sent,pending}
-- and the handler can skip a (batch_id, kol_id) pair that already sent
-- when BullMQ retries the job (D4 idempotency).
--
-- Nullable add — historical rows and any non-batch send stay valid; no
-- backfill needed. Safe to `prisma migrate deploy` with zero downtime.

ALTER TABLE "email_log" ADD COLUMN "batch_id" UUID;

CREATE INDEX "email_log_tenant_id_batch_id_idx" ON "email_log"("tenant_id", "batch_id");

-- ROLLBACK:
-- DROP INDEX "email_log_tenant_id_batch_id_idx";
-- ALTER TABLE "email_log" DROP COLUMN "batch_id";

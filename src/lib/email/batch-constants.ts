/**
 * BL-100-F003 (ADR-020 D3) — shared batch-send constants.
 *
 * Lives outside the `'use server'` actions module so both the server
 * action and the client OutreachComposer can import the cap without the
 * Next 16 "only async exports from a 'use server' file" restriction.
 */

// Per-call recipient cap. Sending is async now (one batch → one BullMQ
// job, throttle sleep runs in the worker), so the old 8-cap + 60s
// wall-clock race from BL-035-F008 is gone — a batch of >10 completes
// fine in the background. We still bound it to keep a single worker
// (concurrency=1) from being monopolised by one giant batch and as basic
// abuse prevention; the per-user 20/min rate limit gates frequency.
export const SEND_BATCH_MAX = 100;

import { BullMQJobQueue } from "./bullmq-queue";

// Job Queue abstraction. The factory at the bottom picks the concrete
// implementation at boot: a BullMQ-backed queue when REDIS_URL is set
// (prod / staging) or the in-memory executor otherwise (tests / dev with
// no Redis). Both honour the same interface + JSON-safe payload contract,
// so call sites never change (BL-100-F001 / ADR-020 D1).

export interface JobPayload {
  [key: string]: unknown;
}

export interface JobOptions {
  /** Defer handler execution by this many milliseconds. */
  delay?: number;
  /** De-duplicate re-entries: second add() with the same key is a no-op
   *  and returns the jobId of the original enqueue. */
  idempotencyKey?: string;
  /** Tenant scope for observability + future BullMQ routing. */
  tenantId?: string;
}

export interface JobContext {
  jobId: string;
  tenantId?: string;
}

export type JobHandler<P = JobPayload> = (payload: P, context: JobContext) => Promise<void>;

export interface JobStats {
  pending: number;
  completed: number;
  failed: number;
}

export interface JobQueue {
  register<P = JobPayload>(name: string, handler: JobHandler<P>): void;
  add<P = JobPayload>(
    name: string,
    payload: P,
    options?: JobOptions
  ): Promise<{ jobId: string }>;
  stats(): JobStats;
}

/**
 * In-memory stub. Runs handlers inline on add(); delayed jobs use a
 * setTimeout and never block the caller. Handler exceptions are caught
 * and counted so the main flow never dies on a background job.
 *
 * Explicit non-goals (B5 will address):
 *   - No persistence across process restart
 *   - No retries / backoff
 *   - No multi-process fan-out
 */
export class InMemoryJobQueue implements JobQueue {
  private readonly handlers = new Map<string, JobHandler<JobPayload>>();
  private readonly idempotency = new Map<string, string>();
  private counter = 0;
  private _pending = 0;
  private _completed = 0;
  private _failed = 0;

  register<P = JobPayload>(name: string, handler: JobHandler<P>): void {
    this.handlers.set(name, handler as JobHandler<JobPayload>);
  }

  async add<P = JobPayload>(
    name: string,
    payload: P,
    options: JobOptions = {}
  ): Promise<{ jobId: string }> {
    if (options.idempotencyKey) {
      const existing = this.idempotency.get(options.idempotencyKey);
      if (existing) return { jobId: existing };
    }

    this.counter += 1;
    const jobId = `job_${Date.now().toString(36)}_${this.counter}`;

    if (options.idempotencyKey) {
      this.idempotency.set(options.idempotencyKey, jobId);
    }

    const handler = this.handlers.get(name);
    if (!handler) {
      console.warn(
        `[jobQueue] No handler registered for "${name}" (jobId=${jobId}); dropping.`
      );
      return { jobId };
    }

    const context: JobContext = { jobId, tenantId: options.tenantId };

    this._pending += 1;

    if (options.delay && options.delay > 0) {
      setTimeout(() => {
        void this.runHandler(name, handler, payload as unknown as JobPayload, context);
      }, options.delay);
      return { jobId };
    }

    await this.runHandler(name, handler, payload as unknown as JobPayload, context);
    return { jobId };
  }

  stats(): JobStats {
    return { pending: this._pending, completed: this._completed, failed: this._failed };
  }

  private async runHandler(
    name: string,
    handler: JobHandler<JobPayload>,
    payload: JobPayload,
    context: JobContext
  ): Promise<void> {
    try {
      await handler(payload, context);
      this._completed += 1;
    } catch (err) {
      this._failed += 1;
      console.error(
        `[jobQueue] Handler "${name}" (jobId=${context.jobId}) threw:`,
        err
      );
    } finally {
      this._pending -= 1;
    }
  }
}

/**
 * Factory — REDIS_URL present → BullMQ (persistent, cross-restart,
 * retryable); absent → in-memory stub (tests / Redis-less dev). The
 * BullMQ import is lazy + guarded so a require/connection failure
 * degrades to in-memory rather than taking down boot (the InMemory path
 * still runs handlers inline, so prewarm self-heals on mount).
 */
function createJobQueue(): JobQueue {
  if (!process.env.REDIS_URL) {
    return new InMemoryJobQueue();
  }
  try {
    // The constructor opens no connection — Queue/Worker are created
    // lazily on first add()/register() — so a `new BullMQJobQueue()` is
    // cheap and only the REDIS_URL path ever touches it.
    return new BullMQJobQueue();
  } catch (err) {
    console.error(
      "[jobQueue] BullMQ init failed; falling back to InMemoryJobQueue:",
      err,
    );
    return new InMemoryJobQueue();
  }
}

/**
 * Process-wide singleton. Handlers register into this instance at app
 * startup via src/lib/jobs/handlers/register.ts, which is imported by
 * src/instrumentation.ts.
 */
export const jobQueue: JobQueue = createJobQueue();

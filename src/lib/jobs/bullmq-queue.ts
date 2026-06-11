/**
 * BL-100-F001 (ADR-020 D1/D2) — BullMQ-backed JobQueue.
 *
 * Implements the same `JobQueue` interface as `InMemoryJobQueue` so the
 * `jobQueue` singleton can be swapped by the factory in `queue.ts`
 * without touching a single call site. Backed by the shared Redis
 * instance (`getBullConnection()`), so jobs persist across process
 * restarts and the in-process Worker resumes them automatically — which
 * is why ADR-020 keeps the Worker inside the Next process rather than a
 * separate pm2 daemon.
 *
 * Connection topology (see redis.ts `getBullConnection`):
 *   - all Queue producers share ONE base connection
 *   - each Worker gets its own `.duplicate()` because BullMQ blocking
 *     commands must not share a socket with producer commands.
 *
 * Concurrency is pinned to 1 per Worker: ADR-020 routes one email batch
 * to one job and leaves the throttle `sleep()` inside the handler, so a
 * single sequential consumer per process is the intended global limiter
 * (Next multi-worker fork is a rare edge — accepted per spec §3).
 */
import type { Job } from "bullmq";
import { Queue, Worker } from "bullmq";

import { getBullConnection } from "@/lib/redis";

import type {
  JobContext,
  JobHandler,
  JobOptions,
  JobPayload,
  JobQueue,
  JobStats,
} from "./queue";

// D5 — bound how long an enqueue may block so a Redis outage surfaces
// quickly and the caller (F003 `sendBatchAction`) can fall back to a
// synchronous send instead of hanging on a dead connection. The abandoned
// add() may still land if Redis recovers, but the (batchId,kolId)
// idempotency guard in batch-send prevents any double send.
const ENQUEUE_TIMEOUT_MS = 5_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`[bullmq] ${label} timed out after ${ms}ms (Redis unreachable?)`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export class BullMQJobQueue implements JobQueue {
  private readonly queues = new Map<string, Queue>();
  private readonly workers = new Map<string, Worker>();
  // Best-effort in-process counters mirroring the InMemoryJobQueue
  // contract. BullMQ keeps the authoritative counts in Redis (queried
  // async via getJobCounts); `stats()` is synchronous by interface, so
  // we surface what this process has observed since boot.
  private _completed = 0;
  private _failed = 0;

  private getQueue(name: string): Queue {
    let queue = this.queues.get(name);
    if (!queue) {
      queue = new Queue(name, {
        connection: getBullConnection(),
        defaultJobOptions: {
          // Retain a bounded history so the dashboard / idempotency
          // dedupe by jobId still resolves recently finished jobs, while
          // keeping Redis memory flat on the 8GB VM.
          removeOnComplete: { count: 200 },
          removeOnFail: { count: 500 },
          // D4 — job retries are safe because the handler is idempotent
          // by (batchId,kolId); 3 attempts with backoff rides out a
          // transient Resend / DB hiccup.
          attempts: 3,
          backoff: { type: "exponential", delay: 5_000 },
        },
      });
      // Surface connection-level failures without crashing the process.
      queue.on("error", (err) => {
        console.error(`[bullmq:${name}] queue error:`, err);
      });
      this.queues.set(name, queue);
    }
    return queue;
  }

  register<P = JobPayload>(name: string, handler: JobHandler<P>): void {
    // Idempotent per process: a second register() (e.g. instrumentation
    // re-import) must not spin up a second competing Worker.
    if (this.workers.has(name)) return;

    const worker = new Worker<JobPayload>(
      name,
      async (job: Job<JobPayload>) => {
        const data = (job.data ?? {}) as JobPayload;
        const context: JobContext = {
          jobId: String(job.id),
          // tenantId is carried inside the payload by both current
          // producers (prewarm + send-email-batch); surface it for
          // observability without a separate metadata channel.
          tenantId:
            typeof data.tenantId === "string" ? (data.tenantId as string) : undefined,
        };
        await (handler as JobHandler<JobPayload>)(data, context);
      },
      {
        // Dedicated blocking connection per worker.
        connection: getBullConnection().duplicate(),
        concurrency: 1,
      },
    );

    worker.on("completed", () => {
      this._completed += 1;
    });
    worker.on("failed", () => {
      this._failed += 1;
    });
    worker.on("error", (err) => {
      console.error(`[bullmq:${name}] worker error:`, err);
    });

    this.workers.set(name, worker);
  }

  async add<P = JobPayload>(
    name: string,
    payload: P,
    options: JobOptions = {},
  ): Promise<{ jobId: string }> {
    const queue = this.getQueue(name);

    const addPromise = queue.add(name, payload as unknown as JobPayload, {
      delay: options.delay && options.delay > 0 ? options.delay : undefined,
      // BullMQ dedupes by jobId: a second add() with a jobId that still
      // exists in the queue (waiting/delayed/active/retained) returns the
      // existing job without re-running the handler — matching the
      // JobOptions.idempotencyKey contract. Once history is evicted a
      // re-add re-runs, which is the accepted self-heal for prewarm.
      jobId: options.idempotencyKey,
    });

    const job = await withTimeout(addPromise, ENQUEUE_TIMEOUT_MS, `enqueue "${name}"`);
    return { jobId: String(job.id) };
  }

  stats(): JobStats {
    return { pending: 0, completed: this._completed, failed: this._failed };
  }

  /**
   * Test/shutdown helper — closes every Worker + Queue so the process can
   * exit cleanly and tests don't leak open handles. Not part of the
   * JobQueue interface; callers use it via a typed cast when needed.
   */
  async close(): Promise<void> {
    await Promise.all([
      ...Array.from(this.workers.values()).map((w) => w.close()),
      ...Array.from(this.queues.values()).map((q) => q.close()),
    ]);
    this.workers.clear();
    this.queues.clear();
  }
}

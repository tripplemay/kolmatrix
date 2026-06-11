"use client";

/**
 * BL-100-F004 (ADR-020 D3) — outreach batch-send state machine.
 *
 * Encapsulates the async send UX so the OutreachComposer stays a view:
 *   1. submit  → call sendBatchAction
 *   2a. sync   → D5 fallback returned the final counts inline → "done"
 *   2b. async  → got a batchId → poll getSendBatchStatus every ~2s,
 *                surfacing "sending {processed}/{total}" progress
 *   3. done    → processed reached total → render the summary
 *   4. stalled → polled past a generous deadline without finishing →
 *                graceful "still sending, check Tracking" hint (the job
 *                keeps running in the worker; this only stops the poll)
 *
 * Extracted as a hook (like useProductFilter) so the polling logic is
 * unit-testable without rendering the whole composer + next-intl + KOL
 * table.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import {
  getSendBatchStatus,
  sendBatchAction,
  type SendBatchInput,
} from "./actions";

const POLL_INTERVAL_MS = 2_000;
// Mirror batch-send's 6s/email throttle so the poll deadline scales with
// batch size; +30s buffer covers enqueue + RPC + DB overhead.
const PER_ITEM_MS = 6_000;
const POLL_BUFFER_MS = 30_000;

export interface SendBatchSummary {
  sent: number;
  mocked: number;
  failed: number;
  items: Array<{ kolId: string; status: string; error?: string }>;
}

export interface SendProgress {
  processed: number;
  total: number;
  sent: number;
  mockSent: number;
  failed: number;
}

export type SendPhase = "idle" | "submitting" | "sending" | "done" | "error" | "stalled";

export interface UseSendBatch {
  phase: SendPhase;
  progress: SendProgress | null;
  result: SendBatchSummary | null;
  error: string | null;
  send: (input: SendBatchInput) => void;
  dismiss: () => void;
}

export function useSendBatch(opts: { onSettled?: () => void } = {}): UseSendBatch {
  // Keep the latest onSettled in a ref so the poll effect's async
  // callbacks call the current closure without re-subscribing the poll
  // loop on every parent render. Updated in an effect (not during render)
  // to satisfy react-hooks/refs.
  const onSettledRef = useRef(opts.onSettled);
  useEffect(() => {
    onSettledRef.current = opts.onSettled;
  }, [opts.onSettled]);

  const [phase, setPhase] = useState<SendPhase>("idle");
  const [progress, setProgress] = useState<SendProgress | null>(null);
  const [result, setResult] = useState<SendBatchSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeBatch, setActiveBatch] = useState<{ batchId: string; total: number } | null>(null);

  const send = useCallback((input: SendBatchInput) => {
    setError(null);
    setResult(null);
    setProgress(null);
    setActiveBatch(null);
    setPhase("submitting");

    void (async () => {
      let res: Awaited<ReturnType<typeof sendBatchAction>>;
      try {
        res = await sendBatchAction(input);
      } catch {
        setPhase("error");
        setError("generic");
        return;
      }
      if (!res.ok) {
        setPhase("error");
        setError(res.error ?? "generic");
        return;
      }
      // D5 sync fallback: counts are already final.
      if (res.mode === "sync" && res.data) {
        setResult({
          sent: res.data.sent,
          mocked: res.data.mocked,
          failed: res.data.failed,
          items: res.data.items,
        });
        setPhase("done");
        onSettledRef.current?.();
        return;
      }
      // Async: begin polling for progress.
      const total = res.total ?? 0;
      const batchId = res.batchId ?? "";
      if (!batchId || total === 0) {
        setResult({ sent: 0, mocked: 0, failed: 0, items: [] });
        setPhase("done");
        onSettledRef.current?.();
        return;
      }
      setProgress({ processed: 0, total, sent: 0, mockSent: 0, failed: 0 });
      setPhase("sending");
      setActiveBatch({ batchId, total });
    })();
  }, []);

  useEffect(() => {
    if (!activeBatch) return;
    const { batchId, total } = activeBatch;
    const maxPolls = Math.max(
      1,
      Math.ceil((total * PER_ITEM_MS + POLL_BUFFER_MS) / POLL_INTERVAL_MS),
    );
    let cancelled = false;
    let polls = 0;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      polls += 1;
      let res: Awaited<ReturnType<typeof getSendBatchStatus>> | null = null;
      try {
        res = await getSendBatchStatus(batchId);
      } catch {
        res = null;
      }
      if (cancelled) return;

      if (res && res.ok) {
        const { sent, mockSent, failed, processed } = res.counts;
        setProgress({ processed, total, sent, mockSent, failed });
        if (processed >= total) {
          setResult({ sent, mocked: mockSent, failed, items: [] });
          setPhase("done");
          setActiveBatch(null);
          setProgress(null);
          onSettledRef.current?.();
          return;
        }
      }

      if (polls >= maxPolls) {
        // Job is still running in the worker — stop polling but tell the
        // user where to find the final result.
        setPhase("stalled");
        setActiveBatch(null);
        return;
      }
      timer = setTimeout(tick, POLL_INTERVAL_MS);
    };

    timer = setTimeout(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeBatch]);

  const dismiss = useCallback(() => {
    setResult(null);
    setError(null);
    setProgress(null);
    setActiveBatch(null);
    setPhase("idle");
  }, []);

  return { phase, progress, result, error, send, dismiss };
}

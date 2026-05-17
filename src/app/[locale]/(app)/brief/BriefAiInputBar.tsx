"use client";

/**
 * BL-069-F003 · AI brief input bar (escape hatch) for /brief page.
 *
 * Top-of-page text input that lets a user paste a free-form marketing
 * brief (e.g. "Q2 推 Genshin Impact 给东南亚游戏受众，预算 $10K USD") and
 * get the campaign form auto-filled via parseBriefAction (F002 server
 * action). Per spec §F003 + §5 不变量 #4 — silent fallback: cap-exhausted,
 * unparsable, and network errors only surface a toast; the form stays
 * usable so the user can fill it manually.
 *
 * Mirrors the BL-068-F003 RefineInputBar.tsx pattern:
 *   - Soft 5s timer that flips toast to network (does NOT abort the
 *     server action — the real response always wins). Hard timeout
 *     remains owned by runAigcAction(timeoutMs:30_000) server-side.
 *   - inflightId ref prevents stale late responses from a prior submit
 *     from overwriting a newer one (user double-click guard).
 *   - errorKind discriminator from F002 → distinct toast variants:
 *     * 'unparsable' — LLM declined to parse, show reason_locale[locale]
 *     * 'malformed' — LLM output missing required fields, show generic
 *       fallback string
 *     * 'product_cross_tenant' — LLM hallucinated a product id; surface
 *       a hint that the product isn't in the user's library
 */
import { useCallback, useRef, useState } from "react";

import { parseBriefAction, type ParsedBriefFields } from "./brief-actions";

const BRIEF_TIMEOUT_MS = 5_000;

export interface BriefAiInputBarLabels {
  inputPlaceholder: string;
  generateButton: string;
  loading: string;
  feedbackPrefix: string;
  unparsableToast: string;
  malformedToast: string;
  productCrossTenantToast: string;
  capExhaustedToast: string;
  networkError: string;
}

interface Props {
  locale: string;
  /** Called when LLM successfully parses the brief. Parent is responsible
   *  for honoring §5 不变量 #6 — only fill empty fields, surface diff
   *  hints on filled ones. */
  onParsed: (fields: ParsedBriefFields) => void;
  labels: BriefAiInputBarLabels;
}

type ToastState =
  | { kind: "idle" }
  | { kind: "success"; text: string }
  | { kind: "unparsable"; text: string }
  | { kind: "malformed" }
  | { kind: "product_cross_tenant" }
  | { kind: "cap" }
  | { kind: "network" };

export function BriefAiInputBar({ locale, onParsed, labels }: Props) {
  const [rawBrief, setRawBrief] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastState>({ kind: "idle" });
  const inflightId = useRef(0);

  const onGenerate = useCallback(async () => {
    const trimmed = rawBrief.trim();
    if (submitting || trimmed.length === 0) return;
    const id = ++inflightId.current;
    setSubmitting(true);
    setToast({ kind: "idle" });

    // SOFT 5s timer — flips toast to network hint, does NOT abort the
    // server action. Real response always wins (see BL-068-F003 fix-
    // round 1 B1 for the prior `Promise.race` bug that this prevents).
    const softTimer: ReturnType<typeof setTimeout> = setTimeout(() => {
      if (id !== inflightId.current) return;
      setToast({ kind: "network" });
    }, BRIEF_TIMEOUT_MS);

    let result: Awaited<ReturnType<typeof parseBriefAction>>;
    try {
      result = await parseBriefAction({ rawBrief: trimmed, locale });
    } catch {
      clearTimeout(softTimer);
      if (id !== inflightId.current) return;
      setSubmitting(false);
      setToast({ kind: "network" });
      return;
    }
    clearTimeout(softTimer);
    if (id !== inflightId.current) return;
    setSubmitting(false);

    if (!result.ok) {
      setToast({ kind: "network" });
      return;
    }
    const { data } = result;
    if (data.capExhausted) {
      setToast({ kind: "cap" });
      return;
    }
    if (data.unparsable) {
      if (data.errorKind === "product_cross_tenant") {
        setToast({ kind: "product_cross_tenant" });
        return;
      }
      if (data.errorKind === "malformed") {
        setToast({ kind: "malformed" });
        return;
      }
      // Plain unparsable — show LLM-provided reason for the user's
      // locale when present, otherwise fall back to the generic
      // unparsable string.
      const text =
        data.feedback && data.feedback.trim().length > 0
          ? data.feedback
          : labels.unparsableToast;
      setToast({ kind: "unparsable", text });
      return;
    }
    if (data.parsed) {
      onParsed(data.parsed);
      setRawBrief("");
      setToast({ kind: "success", text: data.feedback });
    }
  }, [
    rawBrief,
    submitting,
    locale,
    onParsed,
    labels.unparsableToast,
  ]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void onGenerate();
      }
    },
    [onGenerate],
  );

  return (
    <div
      className="space-y-2"
      data-testid="brief-ai-input-bar"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="text"
          value={rawBrief}
          onChange={(e) => setRawBrief(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={labels.inputPlaceholder}
          disabled={submitting}
          maxLength={2000}
          data-testid="brief-ai-input"
          className="h-11 flex-1 rounded-lg border border-outline-variant bg-surface/40 px-3 text-sm text-on-surface placeholder-on-surface-variant/60 focus:border-cyan focus:outline-none focus:ring-1 focus:ring-cyan disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => void onGenerate()}
          disabled={submitting || rawBrief.trim().length === 0}
          data-testid="brief-ai-generate"
          className="gradient-cta flex h-11 min-w-[120px] items-center justify-center rounded-lg px-4 text-sm font-bold text-on-primary transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? labels.loading : labels.generateButton}
        </button>
      </div>
      {toast.kind !== "idle" ? <BriefToast toast={toast} labels={labels} /> : null}
    </div>
  );
}

function BriefToast({
  toast,
  labels,
}: {
  toast: Exclude<ToastState, { kind: "idle" }>;
  labels: BriefAiInputBarLabels;
}) {
  if (toast.kind === "success") {
    return (
      <p
        className="rounded-lg border border-cyan/30 bg-cyan/10 px-3 py-2 text-sm text-cyan"
        data-testid="brief-ai-toast-success"
      >
        <span className="font-bold">{labels.feedbackPrefix}</span> {toast.text}
      </p>
    );
  }
  if (toast.kind === "unparsable") {
    return (
      <p
        className="rounded-lg border border-amber/30 bg-amber/10 px-3 py-2 text-sm text-amber"
        data-testid="brief-ai-toast-unparsable"
      >
        {toast.text}
      </p>
    );
  }
  if (toast.kind === "malformed") {
    return (
      <p
        className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error"
        data-testid="brief-ai-toast-malformed"
      >
        {labels.malformedToast}
      </p>
    );
  }
  if (toast.kind === "product_cross_tenant") {
    return (
      <p
        className="rounded-lg border border-amber/30 bg-amber/10 px-3 py-2 text-sm text-amber"
        data-testid="brief-ai-toast-product-cross-tenant"
      >
        {labels.productCrossTenantToast}
      </p>
    );
  }
  if (toast.kind === "cap") {
    return (
      <p
        className="rounded-lg border border-amber/30 bg-amber/10 px-3 py-2 text-sm text-amber"
        data-testid="brief-ai-toast-cap"
      >
        {labels.capExhaustedToast}
      </p>
    );
  }
  // network
  return (
    <p
      className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error"
      data-testid="brief-ai-toast-network"
    >
      {labels.networkError}
    </p>
  );
}

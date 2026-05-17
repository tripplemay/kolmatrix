"use client";

/**
 * BL-068-F003 · Refine input bar for AiRecommendationPanel.
 *
 * Inline horizontal input bar above the AI recommendation pool that lets a
 * user type a natural-language refine query (e.g. "fewer micro creators,
 * more female audience") and get the current top-30 pool reordered. The
 * server action (refine-actions.ts F002) handles cost-cap / rate-limit /
 * LLM call / permutation validation and always returns a usable pool
 * (silent fallback to the input pool per spec §5 不变量 #5).
 *
 * State surface (kept inside this component):
 *   - rawQuery (controlled input)
 *   - submitting (drives loading affordance + disables button)
 *   - toast (idle / success / unparsable / cap / network)
 *
 * The parent (AiRecommendationPanel) owns the refine cache + applied
 * order; this component calls onRefineApplied with the result and onReset
 * when the user clicks Reset. hasRefineState is read from the parent so
 * the Reset button shows/hides synchronously with the refine pool state.
 */
import { useCallback, useRef, useState } from "react";

import { applyRefineAction } from "./refine-actions";

const REFINE_TIMEOUT_MS = 5_000;

export interface RefineLabels {
  inputPlaceholder: string;
  applyButton: string;
  resetButton: string;
  loading: string;
  feedbackPrefix: string;
  unparsableToast: string;
  capExhaustedToast: string;
  networkError: string;
  permutationInvalid: string;
}

export interface RefineAppliedPayload {
  orderedKolIds: string[];
  feedback: string;
  rawQuery: string;
}

interface Props {
  campaignId: string;
  currentPoolIds: string[];
  locale: string;
  /** True when the parent panel currently has a refine order applied. */
  hasRefineState: boolean;
  /** Last successful feedback string from the LLM (rendered as a sticky toast). */
  lastFeedback: string | null;
  onRefineApplied: (payload: RefineAppliedPayload) => void;
  onReset: () => void;
  labels: RefineLabels;
}

type ToastState =
  | { kind: "idle" }
  | { kind: "success"; text: string }
  | { kind: "unparsable"; text: string }
  | { kind: "permutation" }
  | { kind: "cap" }
  | { kind: "network" };

export function RefineInputBar({
  campaignId,
  currentPoolIds,
  locale,
  hasRefineState,
  lastFeedback,
  onRefineApplied,
  onReset,
  labels,
}: Props) {
  const [rawQuery, setRawQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastState>({ kind: "idle" });
  // Tracks the latest in-flight request so a stale response from a prior
  // submit cannot overwrite a newer one (e.g. user clicks Refine twice).
  const inflightId = useRef(0);

  const onRefine = useCallback(async () => {
    const trimmed = rawQuery.trim();
    if (submitting || trimmed.length === 0 || currentPoolIds.length === 0) {
      return;
    }
    const id = ++inflightId.current;
    setSubmitting(true);
    setToast({ kind: "idle" });

    const timeoutPromise = new Promise<"timeout">((resolve) =>
      setTimeout(() => resolve("timeout"), REFINE_TIMEOUT_MS),
    );
    let result: Awaited<ReturnType<typeof applyRefineAction>> | "timeout";
    try {
      result = await Promise.race([
        applyRefineAction({
          campaignId,
          rawQuery: trimmed,
          currentPoolIds,
          locale,
        }),
        timeoutPromise,
      ]);
    } catch {
      if (id !== inflightId.current) return;
      setSubmitting(false);
      setToast({ kind: "network" });
      return;
    }
    if (id !== inflightId.current) return;
    setSubmitting(false);

    if (result === "timeout") {
      setToast({ kind: "network" });
      return;
    }
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
      // BL-068-F005 — distinguish the 3 unparsable sub-paths via the
      // F002 server `errorKind` discriminator: permutation invalid
      // gets its own toast key + variant; plain unparsable + malformed
      // share the unparsable toast (with LLM per-locale reason when
      // present, fallback to unparsableToast string otherwise).
      if (data.errorKind === "permutation_invalid") {
        setToast({ kind: "permutation" });
        return;
      }
      const text =
        data.feedback && data.feedback.trim().length > 0
          ? data.feedback
          : labels.unparsableToast;
      setToast({ kind: "unparsable", text });
      return;
    }
    // Success path — hand off to parent, keep the feedback in the toast
    // as a sticky banner. Clear the input so a stale query isn't shown
    // alongside an already-applied refine.
    onRefineApplied({
      orderedKolIds: data.orderedKolIds,
      feedback: data.feedback,
      rawQuery: trimmed,
    });
    setRawQuery("");
    setToast({ kind: "success", text: data.feedback });
  }, [
    rawQuery,
    submitting,
    currentPoolIds,
    campaignId,
    locale,
    onRefineApplied,
    labels.unparsableToast,
  ]);

  const onResetClick = useCallback(() => {
    onReset();
    setToast({ kind: "idle" });
  }, [onReset]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void onRefine();
      }
    },
    [onRefine],
  );

  // Sticky feedback toast — when hasRefineState is true and we are idle,
  // surface the parent's last feedback so a refresh shows the user what
  // the current applied order was about.
  const stickyFeedback =
    toast.kind === "idle" && hasRefineState && lastFeedback
      ? { kind: "success" as const, text: lastFeedback }
      : null;
  const visibleToast: ToastState | null =
    toast.kind === "idle" ? stickyFeedback : toast;

  return (
    <section
      className="flex flex-col gap-2"
      data-testid="campaign-refine-input-bar"
    >
      <div className="flex flex-wrap items-center gap-2 rounded-[12px] border border-outline-variant/20 bg-surface-low px-3 py-2">
        <span
          className="material-symbols-outlined text-[18px] text-cyan-fixed"
          aria-hidden
        >
          auto_fix_high
        </span>
        <input
          type="text"
          value={rawQuery}
          onChange={(e) => setRawQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={labels.inputPlaceholder}
          disabled={submitting}
          className="flex-1 min-w-[200px] bg-transparent text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none disabled:opacity-50"
          data-testid="campaign-refine-input"
          aria-label={labels.inputPlaceholder}
          maxLength={500}
        />
        <button
          type="button"
          onClick={() => void onRefine()}
          disabled={submitting || rawQuery.trim().length === 0}
          className="gradient-cta inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold text-on-primary disabled:opacity-50"
          data-testid="campaign-refine-apply"
        >
          {submitting ? (
            <span
              className="material-symbols-outlined animate-spin text-[16px]"
              aria-hidden
            >
              progress_activity
            </span>
          ) : (
            <span
              className="material-symbols-outlined text-[16px]"
              aria-hidden
            >
              auto_awesome
            </span>
          )}
          {submitting ? labels.loading : labels.applyButton}
        </button>
        {hasRefineState ? (
          <button
            type="button"
            onClick={onResetClick}
            disabled={submitting}
            className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant/40 bg-surface px-3 py-1.5 text-sm text-on-surface-variant transition-colors hover:bg-surface-bright disabled:opacity-50"
            data-testid="campaign-refine-reset"
          >
            <span
              className="material-symbols-outlined text-[14px]"
              aria-hidden
            >
              restart_alt
            </span>
            {labels.resetButton}
          </button>
        ) : null}
      </div>

      {visibleToast ? (
        <RefineToast toast={visibleToast} labels={labels} />
      ) : null}
    </section>
  );
}

function RefineToast({
  toast,
  labels,
}: {
  toast: Exclude<ToastState, { kind: "idle" }>;
  labels: RefineLabels;
}) {
  if (toast.kind === "success") {
    return (
      <div
        className="flex items-start gap-2 rounded-lg border border-cyan/30 bg-cyan/10 px-3 py-2 text-sm text-cyan-fixed"
        data-testid="campaign-refine-toast-success"
        role="status"
      >
        <span
          className="material-symbols-outlined text-[16px]"
          aria-hidden
        >
          check_circle
        </span>
        <p>
          <strong className="font-semibold">{labels.feedbackPrefix}:</strong>{" "}
          {toast.text}
        </p>
      </div>
    );
  }
  if (toast.kind === "unparsable") {
    return (
      <div
        className="flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-200"
        data-testid="campaign-refine-toast-unparsable"
        role="status"
      >
        <span
          className="material-symbols-outlined text-[16px]"
          aria-hidden
        >
          help_outline
        </span>
        <p>{toast.text}</p>
      </div>
    );
  }
  if (toast.kind === "cap") {
    return (
      <div
        className="flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-200"
        data-testid="campaign-refine-toast-cap"
        role="status"
      >
        <span
          className="material-symbols-outlined text-[16px]"
          aria-hidden
        >
          hourglass_empty
        </span>
        <p>{labels.capExhaustedToast}</p>
      </div>
    );
  }
  if (toast.kind === "permutation") {
    return (
      <div
        className="flex items-start gap-2 rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error"
        data-testid="campaign-refine-toast-permutation"
        role="status"
      >
        <span
          className="material-symbols-outlined text-[16px]"
          aria-hidden
        >
          warning
        </span>
        <p>{labels.permutationInvalid}</p>
      </div>
    );
  }
  // network
  return (
    <div
      className="flex items-start gap-2 rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error"
      data-testid="campaign-refine-toast-network"
      role="status"
    >
      <span
        className="material-symbols-outlined text-[16px]"
        aria-hidden
      >
        error_outline
      </span>
      <p>{labels.networkError}</p>
    </div>
  );
}

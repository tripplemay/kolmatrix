"use client";

/**
 * BL-067-F004 · DetailedExplanationDialog — 5-segment explainability modal.
 *
 * Fired by the `?` icon on each AiRecommendationPanel KOL card (F003). On
 * first open, calls `requestDetailedExplanationAction` (server) which
 * looks up cache → cost-cap → LLM in that order. UI states:
 *
 *   1. Loading — 5 skeleton sections while the server action races a 5s
 *      AbortController timeout (per spec §F004 acceptance).
 *   2. Success — segments rendered with i18n titles + LLM content.
 *   3. Cap exhausted — `capExhaustedToast` displayed once; dialog still
 *      shows the i18n unavailable message + close button.
 *   4. Timeout / error — `unavailable` text + close button.
 *
 * Per spec §5 不变量 #5, only the dialog path surfaces a toast on cap
 * exhaustion. Pre-warm (F005) is silent.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import {
  Dialog,
  DialogBackdrop,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/Dialog";

import { requestDetailedExplanationAction } from "./explainability-actions";

export interface DetailedExplanationSegments {
  matchScore: string;
  categoryFit: string;
  recentActivity: string;
  audienceFit: string;
  brandHistory: string;
}

export interface DetailedExplanationLabels {
  /** Template string with `{handle}` placeholder. */
  dialogTitle: string;
  loading: string;
  unavailable: string;
  capExhaustedToast: string;
  closeCta: string;
  segments: {
    matchScore: { title: string };
    categoryFit: { title: string };
    recentActivity: { title: string };
    audienceFit: { title: string };
    brandHistory: { title: string };
  };
}

interface Props {
  open: boolean;
  onClose: () => void;
  kolId: string;
  campaignId: string;
  kolHandle: string;
  locale: string;
  labels: DetailedExplanationLabels;
}

const REQUEST_TIMEOUT_MS = 5_000;
const SEGMENT_ORDER: Array<keyof DetailedExplanationSegments> = [
  "matchScore",
  "categoryFit",
  "recentActivity",
  "audienceFit",
  "brandHistory",
];

type DialogState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; segments: DetailedExplanationSegments }
  | { kind: "cap_exhausted" }
  | { kind: "error" };

export function DetailedExplanationDialog({
  open,
  onClose,
  kolId,
  campaignId,
  kolHandle,
  locale,
  labels,
}: Props) {
  const [state, setState] = useState<DialogState>({ kind: "idle" });
  const firedFor = useRef<string | null>(null);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // BL-067-F004 — first-open trigger. Re-firing for the same (kolId, locale)
  // tuple is suppressed (cache hit will be fast on second open anyway).
  // BL-068-F002 hotfix: removed `setState({kind:"idle"})` in the close branch
  // to satisfy react-hooks/set-state-in-effect. The parent (AiRecommendationPanel)
  // conditionally renders the dialog (mount/unmount on open toggle) so a fresh
  // mount initializes state to `idle` via useState's initial value — the
  // synchronous reset here is dead code in normal use. firedFor ref reset
  // is preserved for the defensive same-component-tree case.
  useEffect(() => {
    if (!open) {
      firedFor.current = null;
      return;
    }
    const key = `${campaignId}:${kolId}:${locale}`;
    if (firedFor.current === key) return;
    firedFor.current = key;

    setState({ kind: "loading" });
    let cancelled = false;
    const timeoutId = setTimeout(() => {
      if (cancelled) return;
      cancelled = true;
      setState({ kind: "error" });
    }, REQUEST_TIMEOUT_MS);

    void requestDetailedExplanationAction({ campaignId, kolId, locale })
      .then((res) => {
        if (cancelled) return;
        clearTimeout(timeoutId);
        if (!res.ok) {
          setState({ kind: "error" });
          return;
        }
        if (res.data.fallbackToC2) {
          setState({ kind: "cap_exhausted" });
          return;
        }
        if (res.data.segments == null) {
          setState({ kind: "error" });
          return;
        }
        setState({ kind: "success", segments: res.data.segments });
      })
      .catch((err) => {
        if (cancelled) return;
        clearTimeout(timeoutId);
        console.error(
          "[DetailedExplanationDialog] requestDetailedExplanationAction failed:",
          err,
        );
        setState({ kind: "error" });
      });

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [open, campaignId, kolId, locale]);

  const title = labels.dialogTitle.replace("{handle}", kolHandle);

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : handleClose())}>
      <DialogPortal>
        <DialogBackdrop data-testid="explain-dialog-backdrop" />
        <DialogPanel
          size="lg"
          data-testid="explain-dialog-panel"
          data-kol-id={kolId}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg border border-outline-variant/30 bg-surface px-3 py-1.5 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-bright"
              data-testid="explain-dialog-close"
              aria-label={labels.closeCta}
            >
              {labels.closeCta}
            </button>
          </DialogHeader>

          <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto px-5 py-4">
            {state.kind === "loading" ? (
              <LoadingSkeleton
                loadingLabel={labels.loading}
                segmentLabels={labels.segments}
              />
            ) : null}

            {state.kind === "error" ? (
              <UnavailableMessage
                text={labels.unavailable}
                testid="explain-dialog-unavailable"
              />
            ) : null}

            {state.kind === "cap_exhausted" ? (
              <>
                <div
                  className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300"
                  role="status"
                  data-testid="explain-dialog-cap-toast"
                >
                  {labels.capExhaustedToast}
                </div>
                <UnavailableMessage
                  text={labels.unavailable}
                  testid="explain-dialog-fallback"
                />
              </>
            ) : null}

            {state.kind === "success" ? (
              <SegmentList
                segments={state.segments}
                segmentLabels={labels.segments}
              />
            ) : null}
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg border border-cyan/30 bg-cyan/10 px-4 py-2 text-sm font-semibold text-cyan-fixed transition-colors hover:bg-cyan/20"
              data-testid="explain-dialog-close-footer"
            >
              {labels.closeCta}
            </button>
          </DialogFooter>
        </DialogPanel>
      </DialogPortal>
    </Dialog>
  );
}

function LoadingSkeleton({
  loadingLabel,
  segmentLabels,
}: {
  loadingLabel: string;
  segmentLabels: DetailedExplanationLabels["segments"];
}) {
  return (
    <div className="flex flex-col gap-4" data-testid="explain-dialog-loading">
      <p className="text-xs text-on-surface-variant">{loadingLabel}</p>
      {SEGMENT_ORDER.map((key) => (
        <div
          key={key}
          className="rounded-lg border border-outline-variant/10 bg-surface-low/50 p-3"
        >
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-cyan-fixed">
            {segmentLabels[key].title}
          </p>
          <div className="campaign-ai-recommendation-shimmer h-3 w-full rounded" />
          <div className="campaign-ai-recommendation-shimmer mt-1 h-3 w-3/4 rounded" />
        </div>
      ))}
    </div>
  );
}

function SegmentList({
  segments,
  segmentLabels,
}: {
  segments: DetailedExplanationSegments;
  segmentLabels: DetailedExplanationLabels["segments"];
}) {
  return (
    <div className="flex flex-col gap-4" data-testid="explain-dialog-segments">
      {SEGMENT_ORDER.map((key) => (
        <section
          key={key}
          className="rounded-lg border border-outline-variant/10 bg-surface-low/50 p-3"
          data-testid={`explain-dialog-segment-${key}`}
        >
          <p className="mb-1 text-xs font-bold uppercase tracking-wider text-cyan-fixed">
            {segmentLabels[key].title}
          </p>
          <p className="text-sm leading-relaxed text-on-surface-variant">
            {segments[key]}
          </p>
        </section>
      ))}
    </div>
  );
}

function UnavailableMessage({
  text,
  testid,
}: {
  text: string;
  testid: string;
}) {
  return (
    <div
      className="rounded-lg border border-outline-variant/30 bg-surface-low p-6 text-center text-sm text-on-surface-variant"
      data-testid={testid}
    >
      <span
        className="material-symbols-outlined mb-2 inline-block text-[20px] text-on-surface-variant"
        aria-hidden
      >
        info
      </span>
      <p>{text}</p>
    </div>
  );
}

/**
 * BM2-F009 · Top-bar "AI Insights" button (Planner adjudication
 * §13 #J:A — double entry).
 *
 * Click → smooth-scroll to the right-side panel and dispatch a
 * window event the panel listens for. Panel decides whether to
 * actually fire generate (cache-aware, 2s debounce). This component
 * only owns the navigation / event hand-off, no AI state.
 */
"use client";

import { useCallback } from "react";

interface Props {
  label: string;
}

export function RoiHeaderAiButton({ label }: Props) {
  const handleClick = useCallback(() => {
    const panel = document.getElementById("roi-insights-panel");
    if (panel) {
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    window.dispatchEvent(new CustomEvent("roi-insights-trigger"));
  }, []);

  return (
    <button
      type="button"
      onClick={handleClick}
      data-testid="roi-header-ai-button"
      className="flex items-center gap-2 rounded-xl bg-surface-container-high/70 px-4 py-2 text-xs font-bold text-on-surface hover:bg-surface-container-high"
    >
      <span className="material-symbols-outlined text-sm" aria-hidden>
        auto_awesome
      </span>
      {label}
    </button>
  );
}

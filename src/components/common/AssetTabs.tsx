"use client";

/**
 * BL-025-F004 · `<AssetTabs>` — Detail-panel 4-tab strip.
 *
 * Roles + keyboard navigation per WAI-ARIA tab pattern: Left/Right
 * arrows move focus, Enter/Space activate, Tab moves out of the
 * strip. The tab list itself stays controlled (active tab is owned
 * by the parent panel) so deep-linking via ?tab= and remembering
 * the previous tab on selection-change are both straightforward.
 */
import type { KeyboardEvent } from "react";

import { cn } from "@/lib/utils";

export interface AssetTab<T extends string> {
  id: T;
  label: string;
  /** Optional disabled tabs render dimmed and skip arrow-focus. */
  disabled?: boolean;
}

interface AssetTabsProps<T extends string> {
  tabs: ReadonlyArray<AssetTab<T>>;
  activeTab: T;
  onChange: (next: T) => void;
  ariaLabel?: string;
  className?: string;
}

export function AssetTabs<T extends string>({
  tabs,
  activeTab,
  onChange,
  ariaLabel = "Detail tabs",
  className,
}: AssetTabsProps<T>) {
  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, currentIdx: number) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const enabled = tabs.filter((t) => !t.disabled);
    if (enabled.length <= 1) return;
    const enabledIdx = enabled.findIndex((t) => t.id === tabs[currentIdx]!.id);
    const offset = event.key === "ArrowRight" ? 1 : -1;
    const nextEnabled = enabled[(enabledIdx + offset + enabled.length) % enabled.length]!;
    onChange(nextEnabled.id);
  }

  return (
    <div role="tablist" aria-label={ariaLabel} className={cn("flex border-b border-outline-variant", className)}>
      {tabs.map((tab, idx) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-disabled={tab.disabled || undefined}
            tabIndex={isActive ? 0 : -1}
            disabled={tab.disabled}
            onClick={() => !tab.disabled && onChange(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={cn(
              "px-4 pb-3 pt-4 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/40",
              isActive
                ? "border-cyan text-cyan -mb-px border-b-2 font-semibold"
                : "text-on-surface-variant hover:text-on-surface",
              tab.disabled && "cursor-not-allowed opacity-40"
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

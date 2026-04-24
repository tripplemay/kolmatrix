/**
 * Hotfix-F001 · `<ChipButton>` — pill-shaped filter chip.
 *
 * Renders as a small toggle when `pressed` is provided; falls back to
 * a vanilla button when used as a one-shot CTA. Used by /discovery
 * Active Filter chips, /campaigns status quick-filters, etc.
 */
import { forwardRef } from "react";

import { cn } from "@/lib/utils";

export interface ChipButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  pressed?: boolean;
  /** Renders an `×` close glyph after the label (for clear-filter chips). */
  removable?: boolean;
}

export const ChipButton = forwardRef<HTMLButtonElement, ChipButtonProps>(
  function ChipButton(
    { className, pressed, removable, children, type, ...rest },
    ref
  ) {
    return (
      <button
        ref={ref}
        type={type ?? "button"}
        data-pressed={pressed ? "true" : undefined}
        className={cn(
          "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide transition-colors",
          "border-outline-variant bg-surface-high/40 text-on-surface-variant",
          "hover:border-cyan/40 hover:text-cyan",
          "data-[pressed=true]:border-cyan/60 data-[pressed=true]:bg-cyan/10 data-[pressed=true]:text-cyan",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/40",
          className
        )}
        {...rest}
      >
        {children}
        {removable ? (
          <span
            aria-hidden
            className="material-symbols-outlined text-[14px] opacity-70"
          >
            close
          </span>
        ) : null}
      </button>
    );
  }
);

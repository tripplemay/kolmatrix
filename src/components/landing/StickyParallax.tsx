"use client";

import { useRef, type ReactNode } from "react";
import { useScrollProgress } from "./useScrollProgress";

interface Props {
  /** The element that stays sticky (typically a product screenshot/illustration). */
  stickyAsset: ReactNode;
  /** Array of copy callouts revealed in sequence as the user scrolls. */
  callouts: ReactNode[];
  /** Tailwind class for section background. */
  bgClassName: string;
  /** Tailwind class for section default text color. */
  textClassName: string;
  sectionTestId: string;
  /** Section min-height; default 240vh leaves room for callouts to scroll past. */
  minHeight?: string;
}

/**
 * Sticky-asset + scrolling-callouts container. Used by
 * EmailCenterDemo — product screenshot stays parked on the right
 * while three copy blocks scroll up on the left, each becoming
 * focused (opacity 1) when its progress band is active.
 *
 * Mobile/reduced-motion: falls back to a simple vertical stack.
 */
export function StickyParallax({
  stickyAsset,
  callouts,
  bgClassName,
  textClassName,
  sectionTestId,
  minHeight = "240vh",
}: Props) {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const progress = useScrollProgress(sectionRef);
  const activeIdx = Math.min(
    callouts.length - 1,
    Math.floor(progress * callouts.length)
  );

  return (
    <section
      ref={sectionRef}
      data-testid={sectionTestId}
      data-parallax="sticky"
      className={`${bgClassName} ${textClassName} px-6 lg:px-12`}
      style={{ minHeight }}
    >
      <div className="mx-auto max-w-6xl py-32 grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-12 lg:gap-16">
        {/* Callouts — scroll normally */}
        <div className="space-y-32 lg:space-y-[60vh]">
          {callouts.map((node, idx) => (
            <div
              key={idx}
              data-testid={`landing-parallax-callout-${idx}`}
              data-active={idx === activeIdx}
              className={`transition-opacity duration-500 ${
                idx === activeIdx ? "opacity-100" : "opacity-70"
              }`}
            >
              <span className="font-geist-mono text-[11px] tracking-[0.25em] text-cyan uppercase">
                {String(idx + 1).padStart(2, "0")}
              </span>
              <div className="mt-3">{node}</div>
            </div>
          ))}
        </div>

        {/* Sticky asset — parks half-screen on the right */}
        <div className="lg:sticky lg:top-24 self-start" data-parallax="sticky">
          <div
            className="transition-transform duration-700"
            style={{ transform: `scale(${1 + progress * 0.08})` }}
          >
            {stickyAsset}
          </div>
        </div>
      </div>
    </section>
  );
}

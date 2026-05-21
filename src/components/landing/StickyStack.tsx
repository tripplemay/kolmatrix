"use client";

import type { ReactNode } from "react";

interface Props {
  /** Sticky-rendered left column content (typically an H2 + subtitle). */
  leftContent: ReactNode;
  /** Right column children — scrolling cards / list / panels. */
  children: ReactNode;
  /** Tailwind class for section background — pass "bg-surface-light" etc. */
  bgClassName: string;
  /** Tailwind class for section text default — pass "text-on-surface-light" etc. */
  textClassName: string;
  /** Testid on the outer section. */
  sectionTestId: string;
  /** Optional min-height for the section (default "180vh"). */
  minHeight?: string;
}

/**
 * Two-column sticky layout: left column sticks to viewport while user
 * scrolls; right column scrolls normally. Used by Features (sticky H2
 * + 6 card stack) and Trust (sticky H2 + 3 card stagger).
 *
 * Mobile (<1024px): falls back to single-column normal flow via
 * globals.css `[data-parallax="sticky"]` rule.
 */
export function StickyStack({
  leftContent,
  children,
  bgClassName,
  textClassName,
  sectionTestId,
  minHeight = "180vh",
}: Props) {
  return (
    <section
      data-testid={sectionTestId}
      className={`${bgClassName} ${textClassName} px-6 lg:px-12`}
      style={{ minHeight }}
    >
      <div className="mx-auto max-w-6xl py-32 grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-12 lg:gap-20">
        <div className="lg:sticky lg:top-24 self-start" data-parallax="sticky">
          {leftContent}
        </div>
        <div className="space-y-6">{children}</div>
      </div>
    </section>
  );
}

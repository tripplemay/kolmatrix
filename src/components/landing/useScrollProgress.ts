"use client";

import { useEffect, useState, type RefObject } from "react";

interface Options {
  /**
   * The viewport position (px from top) at which `progress` is 0.
   * Defaults to `window.innerHeight` — i.e. element top = viewport bottom.
   */
  startOffset?: number;
  /**
   * The viewport position (px from top) at which `progress` is 1.
   * Defaults to `-element.height` — i.e. element bottom = viewport top.
   */
  endOffset?: number;
}

/**
 * IntersectionObserver-adjacent scroll-progress reader.
 *
 * Returns a number 0..1 representing how far through its scroll
 * window the referenced element has travelled. 0 means the element is
 * below the viewport (default start = element top at viewport bottom);
 * 1 means the element is above the viewport (default end = element
 * bottom at viewport top).
 *
 * Consumers should write `progress` to a CSS variable rather than
 * inline-styling on every paint, e.g.:
 *
 *   <div ref={ref} style={{ "--p": progress }}>
 *
 * and then in CSS:
 *
 *   transform: translateY(calc(var(--p) * -40px));
 *
 * This keeps React out of the scroll path and lets the browser do
 * cheap compositor-only updates.
 */
export function useScrollProgress(
  ref: RefObject<HTMLElement | null>,
  options: Options = {}
): number {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const compute = () => {
      const rect = el.getBoundingClientRect();
      const vh = typeof window !== "undefined" ? window.innerHeight : 800;
      const start = options.startOffset ?? vh;
      const end = options.endOffset ?? -rect.height;
      const total = start - end;
      const current = start - rect.top;
      const p = total === 0 ? 0 : current / total;
      setProgress(Math.max(0, Math.min(1, p)));
    };

    compute();
    window.addEventListener("scroll", compute, { passive: true });
    window.addEventListener("resize", compute);
    return () => {
      window.removeEventListener("scroll", compute);
      window.removeEventListener("resize", compute);
    };
  }, [ref, options.startOffset, options.endOffset]);

  return progress;
}

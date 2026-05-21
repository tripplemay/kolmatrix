"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Extra class names applied to the wrapper. */
  className?: string;
  /** Delay before the fade transition starts (ms). Useful for stagger. */
  delayMs?: number;
  /** Optional rootMargin override (default '0px 0px -10% 0px' — fire slightly before fully in view). */
  rootMargin?: string;
}

/**
 * Wraps children in a `<div>` that starts at opacity 0 + translate-y 16px
 * and animates to opacity 1 + translate-y 0 the first time the wrapper
 * intersects the viewport.
 *
 * One-shot: once visible, the observer disconnects.
 *
 * Use `delayMs` to stagger sibling reveals (Features cards, Trust cards).
 */
export function ScrollFadeIn({
  children,
  className = "",
  delayMs = 0,
  rootMargin = "0px 0px -10% 0px",
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
            break;
          }
        }
      },
      { rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  return (
    <div
      ref={ref}
      data-testid="scroll-fade-in"
      data-state={visible ? "visible" : "hidden"}
      style={{ transitionDelay: `${delayMs}ms` }}
      className={`transition-all duration-700 ease-out ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      } ${className}`}
    >
      {children}
    </div>
  );
}

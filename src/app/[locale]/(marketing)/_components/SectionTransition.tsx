interface Props {
  /** Where the previous section ends — its background color. */
  from: "dark" | "light";
  /** Where the next section starts — its background color. */
  to: "dark" | "light";
}

/**
 * Gradient strip placed between sections to soften the dark↔light boundary.
 * Refined in BL-078-F004: 24px height (was 16px) for more breathing room +
 * radial mesh accent via `.landing-section-seam` overlay (subtle cyan glow at
 * the midpoint). Decorative only.
 *
 * Two sections sharing the same theme (dark → dark or light → light) still
 * render this as a near-invisible spacer so the page maintains a consistent
 * vertical rhythm.
 */
export function SectionTransition({ from, to }: Props) {
  const cls =
    from === "dark" && to === "light"
      ? "bg-gradient-to-b from-surface to-surface-light"
      : from === "light" && to === "dark"
        ? "bg-gradient-to-b from-surface-light to-surface"
        : from === "dark"
          ? "bg-surface"
          : "bg-surface-light";

  return (
    <div
      data-testid={`landing-section-transition-${from}-${to}`}
      className={`landing-section-seam h-6 ${cls}`}
      aria-hidden="true"
    />
  );
}

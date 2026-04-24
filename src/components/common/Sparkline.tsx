/**
 * Hotfix-F001 (deferred batch) · `<Sparkline>` — minimal inline-SVG
 * trend line for the CRM Cumulative Spend KPI (BM2-F007) and the
 * Dashboard ROI tile (future F009 reuse).
 *
 * Pure presentation: caller hands a numeric series, we normalize to
 * the configured viewBox. No tooltip / hover (UX restraint per
 * adjudication §13.4 #5; B4 polish can layer interactivity).
 */
import { cn } from "@/lib/utils";

export interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  /** Tailwind colour-name; rendered via stroke="currentColor". */
  className?: string;
  /** Accessible label rendered as `<title>`. */
  label?: string;
}

export function Sparkline({
  data,
  width = 120,
  height = 40,
  className,
  label,
}: SparklineProps) {
  if (data.length === 0) {
    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className={cn("text-on-surface-variant/30", className)}
        aria-hidden={!label}
        role={label ? "img" : undefined}
      >
        {label ? <title>{label}</title> : null}
      </svg>
    );
  }

  const max = Math.max(...data, 1);
  // Always reserve a 2px top inset so a flat-zero series still draws
  // a horizontal line instead of disappearing into the top edge.
  const stepX = width / Math.max(data.length - 1, 1);
  const points = data
    .map((v, i) => {
      const x = i * stepX;
      const y = height - (v / max) * (height - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn("text-cyan", className)}
      role="img"
      aria-label={label ?? "Sparkline trend"}
    >
      {label ? <title>{label}</title> : null}
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points}
      />
    </svg>
  );
}

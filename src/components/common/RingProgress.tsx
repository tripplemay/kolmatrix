/**
 * Hotfix-F001 (deferred batch) · `<RingProgress>` — minimalist SVG
 * circular progress indicator. Used on /crm Long-Term Partners KPI
 * to show ratio (e.g., 26.8%); future Dashboard / ROI usages can
 * pass any 0..1 fractional value.
 */
import { cn } from "@/lib/utils";

export interface RingProgressProps {
  /** 0..1 fractional progress. Values outside the range are clamped. */
  value: number;
  size?: number;
  strokeWidth?: number;
  /** Optional centre label (already-formatted text — e.g., "26.8%"). */
  label?: string;
  className?: string;
  /** Accessible name when no centre label gives context. */
  ariaLabel?: string;
}

export function RingProgress({
  value,
  size = 80,
  strokeWidth = 6,
  label,
  className,
  ariaLabel,
}: RingProgressProps) {
  const safeValue = Math.max(0, Math.min(1, value));
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - safeValue);

  return (
    <div
      role="img"
      aria-label={ariaLabel ?? label ?? `Progress ${(safeValue * 100).toFixed(1)}%`}
      className={cn("relative inline-flex", className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90 text-cyan"
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeOpacity={0.18}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: "stroke-dashoffset 250ms ease-out" }}
        />
      </svg>
      {label ? (
        <span
          aria-hidden
          className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-cyan tabular-nums"
        >
          {label}
        </span>
      ) : null}
    </div>
  );
}

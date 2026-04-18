/**
 * AiMatchRingCard — Dashboard KPI 第 4 卡的特例视觉（SVG 环形进度）
 *
 * 决议 #6（F007 §11.1）：不扩 StatCard `progressRing` prop，单独一个
 * Dashboard 独享组件。环形进度是单点特例，强行公共化只会污染 StatCard。
 */
import { cn } from "@/lib/utils";

interface Props {
  score: number;
  label?: string;
  className?: string;
}

const RADIUS = 40;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function AiMatchRingCard({ score, label = "Avg AI Match", className }: Props) {
  const clamped = Math.max(0, Math.min(100, score));
  const offset = CIRCUMFERENCE * (1 - clamped / 100);
  return (
    <div
      className={cn(
        "bg-surface-low ambient-glow relative flex items-center justify-between overflow-hidden rounded-[16px] p-6",
        className
      )}
    >
      <div>
        <p className="text-cyan-fixed flex items-center gap-1 text-sm font-medium">
          <span className="material-symbols-outlined text-[14px]" aria-hidden>
            auto_awesome
          </span>
          {label}
        </p>
        <h3 className="text-cyan mt-1 text-4xl font-black">
          {clamped}
          <span className="text-cyan/50 ml-0.5 text-xl">%</span>
        </h3>
      </div>
      <div className="relative flex h-20 w-20 items-center justify-center">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100" aria-hidden>
          <circle
            cx="50"
            cy="50"
            r={RADIUS}
            fill="transparent"
            stroke="rgba(0, 229, 255, 0.1)"
            strokeWidth="8"
          />
          <circle
            cx="50"
            cy="50"
            r={RADIUS}
            fill="transparent"
            stroke="currentColor"
            className="text-cyan"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
          />
        </svg>
        <span className="material-symbols-outlined text-cyan/50 absolute text-2xl" aria-hidden>
          psychology
        </span>
      </div>
    </div>
  );
}

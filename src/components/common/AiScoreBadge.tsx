/**
 * AiScoreBadge — AI 匹配分数视觉徽章（0-100）
 *
 * 三形态：
 *  - circle: 圆形浮标，常定位在 KolCard 右上 (-top-3 -right-3)
 *  - pill : 药丸内嵌（表格 / 行列表）
 *  - inline: 纯文本（KPI 卡内嵌数字，无背景）
 * HTML 源：dashboard.html:366-368 (circle) / kol-database.html (pill)。
 * Horizon（BL-HORIZON F003）：brand 紫强调；发光/浮起由 `shadow-hz-card`
 * 承担，不内联 HEX。
 */
import { cn } from "@/lib/utils";

type Variant = "circle" | "pill" | "inline";
type Size = "sm" | "md" | "lg";

interface AiScoreBadgeProps {
  score: number;
  variant?: Variant;
  size?: Size;
  glow?: boolean;
  className?: string;
  ariaLabel?: string;
}

const TEXT_SIZE: Record<Size, string> = {
  sm: "text-xs",
  md: "text-lg",
  lg: "text-4xl",
};

const CIRCLE_SIZE: Record<Size, string> = {
  sm: "h-8 w-8",
  md: "h-12 w-12",
  lg: "h-16 w-16",
};

export function AiScoreBadge({
  score,
  variant = "circle",
  size = "md",
  glow = true,
  className,
  ariaLabel,
}: AiScoreBadgeProps) {
  const label = ariaLabel ?? `AI match score ${score}`;

  if (variant === "inline") {
    return (
      <span aria-label={label} className={cn("text-brand-400 font-bold", TEXT_SIZE[size], className)}>
        {score}
      </span>
    );
  }

  if (variant === "pill") {
    return (
      <span
        aria-label={label}
        className={cn(
          "text-brand-400 bg-brand-500/10 border-brand-500/30 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-semibold",
          TEXT_SIZE[size],
          glow && "shadow-hz-card",
          className
        )}
      >
        {score}
      </span>
    );
  }

  return (
    <span
      aria-label={label}
      className={cn(
        "glass-panel text-brand-400 border-brand-500/30 inline-flex items-center justify-center rounded-full border font-bold",
        CIRCLE_SIZE[size],
        TEXT_SIZE[size],
        glow && "shadow-hz-card",
        className
      )}
    >
      {score}
    </span>
  );
}

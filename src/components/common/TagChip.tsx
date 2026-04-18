/**
 * TagChip — 标签芯片（KOL 分类 / Campaign 行业 / Email 分组）
 *
 * Canonical 形状（多数派）：`rounded-full` pill。
 * HTML 源：dashboard.html:376-378（KolCard 下方 navy pill）。
 * Tones：neutral（默认，中性 navy 底）/ cyan（AI 高亮）/ purple（分类）/
 *   navy（更深背景变体）。
 */
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type Tone = "neutral" | "navy" | "cyan" | "purple";
type Size = "xs" | "sm";

interface TagChipProps {
  label: string;
  tone?: Tone;
  size?: Size;
  icon?: ReactNode;
  className?: string;
}

const TONE_MAP: Record<Tone, string> = {
  neutral: "bg-on-surface/5 text-on-surface-variant border border-on-surface/10",
  navy: "bg-surface-lowest text-on-surface-variant border border-transparent",
  cyan: "bg-cyan/10 text-cyan border border-cyan/25",
  purple: "bg-purple/10 text-purple border border-purple/25",
};

const SIZE_MAP: Record<Size, string> = {
  xs: "text-[10px] px-2 py-0.5",
  sm: "text-[11px] px-2.5 py-1",
};

export function TagChip({ label, tone = "neutral", size = "xs", icon, className }: TagChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium whitespace-nowrap",
        TONE_MAP[tone],
        SIZE_MAP[size],
        className
      )}
    >
      {icon}
      {label}
    </span>
  );
}

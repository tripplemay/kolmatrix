/**
 * GlassPanel — Neural Velocity 玻璃拟态容器
 *
 * 薄封装在 `@utility glass-panel` 上，统一圆角 / 内边距 / 描边 /
 * 环境发光。面板之间共享的外壳原语；内容自由。
 * HTML 源：kol-discovery.html §Filters panel 等 7 页通用。
 * Canonical（F010 决议 #3）：默认 neutral 描边；cyan 描边语义强调 AI。
 */
import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

type PaddingScale = "sm" | "md" | "lg";
type RoundedScale = "xl" | "2xl";

interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  rounded?: RoundedScale;
  padding?: PaddingScale;
  tone?: "neutral" | "cyan";
  glow?: boolean;
}

const PADDING_MAP: Record<PaddingScale, string> = {
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
};

const ROUNDED_MAP: Record<RoundedScale, string> = {
  xl: "rounded-[16px]",
  "2xl": "rounded-[20px]",
};

export function GlassPanel({
  children,
  rounded = "xl",
  padding = "md",
  tone = "neutral",
  glow = false,
  className,
  ...rest
}: GlassPanelProps) {
  return (
    <div
      className={cn(
        "bg-navy-800 shadow-hz-card",
        ROUNDED_MAP[rounded],
        PADDING_MAP[padding],
        "border",
        tone === "cyan" ? "border-brand-500/20" : "border-on-surface/5",
        glow && "shadow-hz-card",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

/**
 * SectionHeader — 区块标题（title + 可选副标 + 可选右侧 action 列）
 *
 * 跨所有 7 页，h1/h2/h3 级别按区块重要程度选择。右侧 actions 支持 ghost
 * / secondary / gradient 三种 variant（不强制要求复用 button 组件，避免
 * 子组件类型耦合；由调用方决定）。
 * HTML 源：dashboard.html:263-265 (ghost View All 模式)。
 */
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type HeadingLevel = "h1" | "h2" | "h3";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  as?: HeadingLevel;
  actions?: ReactNode;
  className?: string;
}

const TITLE_SIZE: Record<HeadingLevel, string> = {
  h1: "text-[28px] sm:text-[32px] font-extrabold tracking-[-0.02em]",
  h2: "text-xl font-bold",
  h3: "text-lg font-bold",
};

export function SectionHeader({
  title,
  subtitle,
  as = "h3",
  actions,
  className,
}: SectionHeaderProps) {
  const Heading = as;
  return (
    <header className={cn("mb-6 flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <Heading className={cn("text-on-surface", TITLE_SIZE[as])}>{title}</Heading>
        {subtitle ? (
          <p className="text-on-surface-variant/70 mt-1 text-[13px]">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

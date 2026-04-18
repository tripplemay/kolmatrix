/**
 * GhostButton — 幽灵按钮（纯文本 + hover 转色）
 *
 * 典型用法："View All →" / "Clear all" / 表格行内小操作。无 bg / 无 border，
 * hover 时文字渐变到 cyan。HTML 源：dashboard.html:265。
 */
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

type Size = "sm" | "md";

interface GhostButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  icon?: ReactNode;
  iconPosition?: "left" | "right";
  size?: Size;
}

const SIZE_MAP: Record<Size, string> = {
  sm: "text-[12px] gap-1 h-8 px-1",
  md: "text-[13px] gap-1.5 h-9 px-2",
};

export function GhostButton({
  children,
  icon,
  iconPosition = "right",
  size = "md",
  className,
  disabled,
  ...rest
}: GhostButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "text-on-surface-variant hover:text-cyan inline-flex items-center rounded-[8px] font-medium transition-colors duration-200",
        "disabled:cursor-not-allowed disabled:opacity-50",
        SIZE_MAP[size],
        className
      )}
      {...rest}
    >
      {icon && iconPosition === "left" ? (
        <span className="inline-flex shrink-0">{icon}</span>
      ) : null}
      <span className="inline-flex items-center">{children}</span>
      {icon && iconPosition === "right" ? (
        <span className="inline-flex shrink-0">{icon}</span>
      ) : null}
    </button>
  );
}

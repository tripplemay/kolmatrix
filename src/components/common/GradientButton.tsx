/**
 * GradientButton — Cyan 渐变主 CTA
 *
 * 统一消费 `@utility gradient-cta`。三尺寸：sm/md/lg 映射 Stitch HTML
 * 里 rounded-lg (size md) / rounded-xl (size lg) 的变体。
 * HTML 源：dashboard.html:182-185 ("+ New Campaign")。
 * 用途：每页头部的主 CTA（New Campaign / Apply Filters / Edit 等）。
 */
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg";

interface GradientButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  icon?: ReactNode;
  iconPosition?: "left" | "right";
  size?: Size;
  fullWidth?: boolean;
  loading?: boolean;
}

const SIZE_MAP: Record<Size, string> = {
  sm: "h-9 px-4 text-[13px] rounded-[10px]",
  md: "h-10 px-5 text-[14px] rounded-[12px]",
  lg: "h-12 px-6 text-[14px] rounded-[14px]",
};

export function GradientButton({
  children,
  icon,
  iconPosition = "left",
  size = "md",
  fullWidth = false,
  loading = false,
  disabled,
  className,
  ...rest
}: GradientButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cn(
        "gradient-cta inline-flex items-center justify-center gap-2 font-semibold transition-shadow duration-200",
        "hover:shadow-[0_0_24px_rgba(0,229,255,0.4)]",
        "disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:shadow-none",
        fullWidth && "w-full",
        SIZE_MAP[size],
        className
      )}
      {...rest}
    >
      {icon && iconPosition === "left" ? (
        <span className="inline-flex shrink-0">{icon}</span>
      ) : null}
      <span className="inline-flex items-center">
        {loading ? (
          <span className="material-symbols-outlined animate-spin text-[18px]" aria-hidden>
            progress_activity
          </span>
        ) : (
          children
        )}
      </span>
      {icon && iconPosition === "right" ? (
        <span className="inline-flex shrink-0">{icon}</span>
      ) : null}
    </button>
  );
}

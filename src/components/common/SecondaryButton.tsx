/**
 * SecondaryButton — 次级按钮（中性 / purple / cyan 三色调）
 *
 * 低强度邀请操作，不与 GradientButton CTA 争抢焦点。样式语义：半透明色块 +
 * 描边 + 同色文字。HTML 源：campaign-detail.html:217 (Add KOLs)。
 */
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

type Tone = "neutral" | "purple" | "cyan";
type Size = "sm" | "md" | "lg";

interface SecondaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  size?: Size;
}

const TONE_MAP: Record<Tone, string> = {
  neutral:
    "bg-on-surface/5 text-on-surface border-on-surface/10 hover:bg-on-surface/10 hover:text-on-surface",
  purple: "bg-purple/10 text-purple border-purple/30 hover:bg-purple/15 hover:text-purple",
  cyan: "bg-cyan/10 text-cyan border-cyan/30 hover:bg-cyan/15 hover:text-cyan",
};

const SIZE_MAP: Record<Size, string> = {
  sm: "h-9 px-4 text-[13px] rounded-[10px]",
  md: "h-10 px-5 text-[14px] rounded-[12px]",
  lg: "h-12 px-6 text-[14px] rounded-[14px]",
};

export function SecondaryButton({
  children,
  icon,
  tone = "neutral",
  size = "md",
  className,
  disabled,
  ...rest
}: SecondaryButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center gap-2 border font-semibold transition-colors duration-200",
        "disabled:cursor-not-allowed disabled:opacity-60",
        TONE_MAP[tone],
        SIZE_MAP[size],
        className
      )}
      {...rest}
    >
      {icon ? <span className="inline-flex shrink-0">{icon}</span> : null}
      {children}
    </button>
  );
}

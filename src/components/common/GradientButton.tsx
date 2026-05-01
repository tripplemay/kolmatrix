/**
 * GradientButton — Cyan 渐变主 CTA
 *
 * 统一消费 `@utility gradient-cta`。三尺寸：sm/md/lg 映射 Stitch HTML
 * 里 rounded-lg (size md) / rounded-xl (size lg) 的变体。
 * HTML 源：dashboard.html:182-185 ("+ New Campaign")。
 * 用途：每页头部的主 CTA（New Campaign / Apply Filters / Edit 等）。
 *
 * BIx-mvp-polish-pass F002 (2026-05-01) — `href` prop added so the
 * dashboard "New Campaign" GreetingBar button (and any other main CTA
 * that wants link semantics) actually navigates instead of being a
 * silent <button> with no onClick. When href is set AND the button is
 * not disabled/loading, render a next/link <Link>; otherwise fall
 * back to <button> for the disabled/loading a11y story (disabled
 * links are unreachable + screen-reader-confusing).
 */
import type { ButtonHTMLAttributes, ReactNode } from "react";

import Link from "next/link";

import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg";

interface GradientButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  icon?: ReactNode;
  iconPosition?: "left" | "right";
  size?: Size;
  fullWidth?: boolean;
  loading?: boolean;
  /**
   * When set, the button renders as a next/link <a>. Disabled/loading
   * states still fall back to <button> for a11y reasons.
   */
  href?: string;
}

const SIZE_MAP: Record<Size, string> = {
  sm: "h-9 px-4 text-[13px] rounded-[10px]",
  md: "h-10 px-5 text-[14px] rounded-[12px]",
  lg: "h-12 px-6 text-[14px] rounded-[14px]",
};

const BASE_CLASS =
  "gradient-cta inline-flex items-center justify-center gap-2 font-semibold transition-shadow duration-200 hover:shadow-[0_0_24px_rgba(0,229,255,0.4)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:shadow-none";

function Inner({
  icon,
  iconPosition,
  loading,
  children,
}: {
  icon?: ReactNode;
  iconPosition: "left" | "right";
  loading: boolean;
  children: ReactNode;
}) {
  return (
    <>
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
    </>
  );
}

export function GradientButton({
  children,
  icon,
  iconPosition = "left",
  size = "md",
  fullWidth = false,
  loading = false,
  disabled,
  className,
  href,
  ...rest
}: GradientButtonProps) {
  const composed = cn(BASE_CLASS, fullWidth && "w-full", SIZE_MAP[size], className);

  // href semantics only kick in when the button is interactive — disabled
  // / loading still render <button disabled> to avoid the a11y trap of
  // an "interactive" <a> the user can't actually click.
  if (href && !disabled && !loading) {
    return (
      <Link href={href} className={composed}>
        <Inner icon={icon} iconPosition={iconPosition} loading={false}>
          {children}
        </Inner>
      </Link>
    );
  }

  return (
    <button type="button" disabled={disabled || loading} className={composed} {...rest}>
      <Inner icon={icon} iconPosition={iconPosition} loading={loading}>
        {children}
      </Inner>
    </button>
  );
}

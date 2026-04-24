/**
 * Hotfix-F001 · `<Button>` atom.
 *
 * 5 variants × 3 sizes built on `class-variance-authority`. Reuses the
 * project's existing `gradient-cta` Tailwind class for the headline
 * `primary-gradient` look so callers swapping ad-hoc buttons for this
 * atom keep pixel-identical visuals.
 *
 * Variants:
 *   primary-gradient — headline CTA (gradient-cta)
 *   secondary       — outlined cyan
 *   ghost           — transparent + hover
 *   danger          — error tone (delete / destructive)
 *   chip            — small filter chip; toggle on/off via `data-pressed`
 */
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/40",
  {
    variants: {
      variant: {
        "primary-gradient":
          "gradient-cta text-on-primary shadow-[0_0_12px_rgba(0,229,255,0.2)] hover:scale-[1.02]",
        secondary:
          "border border-cyan/30 bg-cyan/5 text-cyan hover:bg-cyan/10",
        ghost:
          "border border-outline-variant text-on-surface-variant hover:border-cyan/40 hover:text-cyan",
        danger:
          "border border-error/30 bg-error/10 text-error hover:bg-error/20",
        chip:
          "border border-outline-variant bg-surface-high/40 text-on-surface-variant hover:border-cyan/40 hover:text-cyan data-[pressed=true]:border-cyan/60 data-[pressed=true]:bg-cyan/10 data-[pressed=true]:text-cyan",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-5 text-sm",
        lg: "h-12 px-6 text-base",
      },
    },
    defaultVariants: {
      variant: "primary-gradient",
      size: "md",
    },
  }
);

export type ButtonVariant = NonNullable<
  VariantProps<typeof buttonVariants>["variant"]
>;
export type ButtonSize = NonNullable<
  VariantProps<typeof buttonVariants>["size"]
>;

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Sets `data-pressed` on the chip variant for filter-style toggles. */
  pressed?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ className, variant, size, pressed, type, ...rest }, ref) {
    return (
      <button
        ref={ref}
        type={type ?? "button"}
        data-pressed={pressed ? "true" : undefined}
        className={cn(buttonVariants({ variant, size }), className)}
        {...rest}
      />
    );
  }
);

export { buttonVariants };

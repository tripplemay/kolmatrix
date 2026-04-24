"use client";

/**
 * Hotfix-F001 · `<Dialog>` atom — base-ui composition with our look.
 *
 * Re-exports `@base-ui/react/dialog` Parts and adds a styled
 * `<DialogPanel>` + `<DialogBackdrop>` so callers don't have to repeat
 * the glass-panel + cyan focus tokens every time. Trigger / open state
 * stays caller-controlled via `open` + `onOpenChange` props.
 */
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { forwardRef, useId } from "react";

import { cn } from "@/lib/utils";

interface DialogRootProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogRootProps) {
  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      {children}
    </BaseDialog.Root>
  );
}

export const DialogTrigger = BaseDialog.Trigger;
export const DialogClose = BaseDialog.Close;
export const DialogPortal = BaseDialog.Portal;

type DialogBackdropProps = React.HTMLAttributes<HTMLDivElement>;

export const DialogBackdrop = forwardRef<HTMLDivElement, DialogBackdropProps>(
  function DialogBackdrop({ className, ...rest }, ref) {
    return (
      <BaseDialog.Backdrop
        ref={ref}
        className={cn(
          "fixed inset-0 z-50 bg-navy-base/80 backdrop-blur-sm",
          className
        )}
        {...rest}
      />
    );
  }
);

interface DialogPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Max-width preset; passes through to the outer panel. */
  size?: "sm" | "md" | "lg";
}

const PANEL_SIZE: Record<NonNullable<DialogPanelProps["size"]>, string> = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-3xl",
};

export const DialogPanel = forwardRef<HTMLDivElement, DialogPanelProps>(
  function DialogPanel({ className, size = "md", children, ...rest }, ref) {
    return (
      <BaseDialog.Popup
        ref={ref}
        className={cn(
          "glass-panel fixed left-1/2 top-1/2 z-50 flex w-full -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-on-surface/10 shadow-[0_30px_80px_rgba(0,0,0,0.5)]",
          PANEL_SIZE[size],
          className
        )}
        {...rest}
      >
        {children}
      </BaseDialog.Popup>
    );
  }
);

interface DialogTitleProps {
  children: React.ReactNode;
  className?: string;
}

export function DialogTitle({ children, className }: DialogTitleProps) {
  const id = useId();
  return (
    <BaseDialog.Title
      id={id}
      className={cn("text-base font-semibold text-white", className)}
    >
      {children}
    </BaseDialog.Title>
  );
}

interface DialogHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function DialogHeader({ children, className }: DialogHeaderProps) {
  return (
    <header
      className={cn(
        "flex items-center justify-between gap-4 border-b border-white/5 px-5 py-4",
        className
      )}
    >
      {children}
    </header>
  );
}

interface DialogFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function DialogFooter({ children, className }: DialogFooterProps) {
  return (
    <footer
      className={cn(
        "flex flex-wrap items-center justify-end gap-3 border-t border-white/5 px-5 py-4",
        className
      )}
    >
      {children}
    </footer>
  );
}

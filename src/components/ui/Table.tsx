/**
 * Hotfix-F001 · `<Table>` composite.
 *
 * Pure layout helpers — replace ad-hoc `<table>`/`<th>`/`<td>` walls
 * across BM1 /database, BM2 /campaigns, etc. No interaction state
 * (sort, selection) lives here; pages drive that with their own
 * useState + URL params.
 */
import { forwardRef } from "react";

import { cn } from "@/lib/utils";

export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  /** Sticks `<thead>` to the scroll container's top. */
  stickyHeader?: boolean;
}

export const Table = forwardRef<HTMLTableElement, TableProps>(function Table(
  { className, stickyHeader, children, ...rest },
  ref
) {
  return (
    <div
      className={cn(
        "glass-panel overflow-hidden rounded-2xl border border-on-surface/5",
        stickyHeader && "max-h-[70vh] overflow-y-auto"
      )}
    >
      <table
        ref={ref}
        className={cn(
          "w-full border-collapse text-left text-sm",
          stickyHeader && "[&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10",
          className
        )}
        {...rest}
      >
        {children}
      </table>
    </div>
  );
});

export function THead({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <thead
      className={cn(
        "border-b border-white/5 bg-surface-low/60 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant backdrop-blur",
        className
      )}
    >
      {children}
    </thead>
  );
}

export function TBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <tbody className={className}>{children}</tbody>;
}

export interface TRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  interactive?: boolean;
}

export const TRow = forwardRef<HTMLTableRowElement, TRowProps>(function TRow(
  { className, interactive = true, children, ...rest },
  ref
) {
  return (
    <tr
      ref={ref}
      className={cn(
        "border-b border-white/5 text-sm text-on-surface last:border-none",
        interactive && "transition-colors hover:bg-white/[0.03]",
        className
      )}
      {...rest}
    >
      {children}
    </tr>
  );
});

type Align = "left" | "right" | "center";

const ALIGN_CLASS: Record<Align, string> = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
};

export interface TCellProps
  extends React.TdHTMLAttributes<HTMLTableCellElement> {
  align?: Align;
  numeric?: boolean;
  /** Render as `<th>` instead of `<td>`. */
  as?: "th" | "td";
}

export function TCell({
  align = "left",
  numeric,
  as = "td",
  className,
  children,
  ...rest
}: TCellProps) {
  const Tag = as as "td" | "th";
  return (
    <Tag
      className={cn(
        "px-4 py-3",
        ALIGN_CLASS[align],
        numeric && "tabular-nums",
        className
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

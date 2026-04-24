/**
 * Hotfix-F001 · `<Select>` atom.
 *
 * Native HTML select wrapped to match the `<Input>` style. The
 * @base-ui/react Select is great for rich combobox-like UIs, but for
 * plain dropdowns the native element keeps URL-driven GET forms
 * (BM1 /discovery / /database) trivial — we only need consistent
 * styling, not custom popup positioning. If a feature needs a search
 * combobox later we can add a `<RichSelect>` sibling at that point.
 */
import { forwardRef } from "react";

import { cn } from "@/lib/utils";

const SELECT_BASE =
  "h-10 w-full rounded-lg border border-outline-variant bg-surface/40 px-3 text-sm text-on-surface focus:border-cyan focus:outline-none focus:ring-1 focus:ring-cyan disabled:cursor-not-allowed disabled:opacity-60";

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, invalid, children, ...rest },
  ref
) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid ? "true" : undefined}
      className={cn(
        SELECT_BASE,
        invalid && "border-error focus:border-error focus:ring-error/40",
        className
      )}
      {...rest}
    >
      {children}
    </select>
  );
});

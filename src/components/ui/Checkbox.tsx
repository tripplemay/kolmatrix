"use client";

/**
 * Hotfix-F001 · `<Checkbox>` atom — base-ui composition with our look.
 *
 * Supports `checked` / `onCheckedChange` / `indeterminate` for the
 * Bulk Action header-row "select all but some" state. Renders as a
 * styled square with a check or dash icon.
 */
import { Checkbox as BaseCheckbox } from "@base-ui/react/checkbox";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";

export interface CheckboxProps {
  checked?: boolean;
  defaultChecked?: boolean;
  indeterminate?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  name?: string;
  value?: string;
  id?: string;
  className?: string;
  /** ARIA label when no visible <label> sits next to it. */
  "aria-label"?: string;
}

export const Checkbox = forwardRef<HTMLButtonElement, CheckboxProps>(
  function Checkbox(
    {
      checked,
      defaultChecked,
      indeterminate,
      onCheckedChange,
      disabled,
      className,
      name,
      value,
      id,
      ...aria
    },
    ref
  ) {
    return (
      <BaseCheckbox.Root
        ref={ref}
        checked={checked}
        defaultChecked={defaultChecked}
        indeterminate={indeterminate}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        name={name}
        value={value}
        id={id}
        data-indeterminate={indeterminate ? "true" : undefined}
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded border border-outline-variant bg-surface/40 text-cyan transition-colors",
          "hover:border-cyan/40",
          "data-[checked]:border-cyan/60 data-[checked]:bg-cyan/10",
          "data-[indeterminate=true]:border-cyan/60 data-[indeterminate=true]:bg-cyan/10",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/40",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...aria}
      >
        <BaseCheckbox.Indicator
          className="flex h-full w-full items-center justify-center"
        >
          <span
            aria-hidden
            className="material-symbols-outlined text-[14px] font-bold"
          >
            {indeterminate ? "remove" : "check"}
          </span>
        </BaseCheckbox.Indicator>
      </BaseCheckbox.Root>
    );
  }
);

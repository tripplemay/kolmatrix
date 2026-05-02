"use client";

/**
 * BL-025-F004 · `<Combobox>` atom — single-select with search filter.
 *
 * The native `<Select>` (src/components/ui/Select.tsx) wraps the
 * browser's `<select>` element so it can't filter options client-side.
 * /assets needs a Product picker that lets a marketer search across
 * 100+ products by name; this component is the answer.
 *
 * Built on @base-ui/react Combobox primitive (already pinned in
 * package.json + optimizePackageImports). Visual style mirrors
 * ui/Select so the two atoms can be swapped where appropriate.
 *
 * API matches React form-control conventions: controlled `value` /
 * `onChange`. Items are `{value, label}`. The empty state surfaces
 * "No matches" so a stray query never returns silent zero rows.
 */
import { Combobox as BaseCombobox } from "@base-ui/react/combobox";
import { useId, useMemo } from "react";

import { cn } from "@/lib/utils";

export interface ComboboxItem {
  value: string;
  label: string;
}

export interface ComboboxProps {
  items: ReadonlyArray<ComboboxItem>;
  value: string | null;
  onChange: (next: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** ARIA-friendly label fallback when no `<label>` is rendered. */
  ariaLabel?: string;
  /** Surface a custom note under the popup (e.g. "12 assets"). */
  emptyMessage?: string;
}

const TRIGGER_BASE =
  "h-10 w-full rounded-lg border border-outline-variant bg-surface/40 px-3 text-sm text-on-surface focus:border-cyan focus:outline-none focus:ring-1 focus:ring-cyan disabled:cursor-not-allowed disabled:opacity-60 flex items-center justify-between gap-2";

export function Combobox({
  items,
  value,
  onChange,
  placeholder = "Select…",
  disabled,
  className,
  ariaLabel,
  emptyMessage = "No matches",
}: ComboboxProps) {
  const inputId = useId();
  // Stable map for label lookup so the trigger surfaces the chosen
  // item's label (not the raw value).
  const labelByValue = useMemo(() => {
    const m = new Map<string, string>();
    for (const item of items) m.set(item.value, item.label);
    return m;
  }, [items]);

  const selectedLabel = value != null ? (labelByValue.get(value) ?? null) : null;

  return (
    <BaseCombobox.Root
      items={items as ComboboxItem[]}
      itemToStringValue={(item: ComboboxItem) => item.value}
      itemToStringLabel={(item: ComboboxItem) => item.label}
      value={items.find((i) => i.value === value) ?? null}
      onValueChange={(next: ComboboxItem | null) => onChange(next?.value ?? null)}
      disabled={disabled}
    >
      <BaseCombobox.Input
        aria-label={ariaLabel}
        id={inputId}
        placeholder={selectedLabel ?? placeholder}
        className={cn(TRIGGER_BASE, className)}
      />
      <BaseCombobox.Portal>
        <BaseCombobox.Positioner sideOffset={4}>
          <BaseCombobox.Popup
            className={cn(
              "z-50 max-h-[260px] min-w-[220px] overflow-auto rounded-lg border p-1 shadow-lg",
              "border-outline-variant bg-surface text-on-surface"
            )}
          >
            <BaseCombobox.Empty className="px-3 py-2 text-xs text-on-surface-variant">
              {emptyMessage}
            </BaseCombobox.Empty>
            <BaseCombobox.List>
              {(item: ComboboxItem) => (
                <BaseCombobox.Item
                  key={item.value}
                  value={item}
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-sm",
                    "data-[highlighted]:bg-cyan/10 data-[highlighted]:text-cyan",
                    "data-[selected]:bg-cyan/15 data-[selected]:font-medium data-[selected]:text-cyan"
                  )}
                >
                  <span className="truncate">{item.label}</span>
                  <BaseCombobox.ItemIndicator className="text-cyan">
                    <span className="material-symbols-outlined text-[16px]" aria-hidden>
                      check
                    </span>
                  </BaseCombobox.ItemIndicator>
                </BaseCombobox.Item>
              )}
            </BaseCombobox.List>
          </BaseCombobox.Popup>
        </BaseCombobox.Positioner>
      </BaseCombobox.Portal>
    </BaseCombobox.Root>
  );
}

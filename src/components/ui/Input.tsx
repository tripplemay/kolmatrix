/**
 * Hotfix-F001 · `<Input>` atom + Label + FieldError helpers.
 *
 * Wraps a native `<input>` with the project's standard h-10 cyan-focus
 * border treatment. Keep the API React-native — pages can still pass
 * `name` / `defaultValue` / `onChange` directly as if writing raw HTML.
 */
import { forwardRef } from "react";

import { cn } from "@/lib/utils";

const INPUT_BASE =
  "h-10 w-full rounded-lg border border-outline-variant bg-surface/40 px-3 text-sm text-on-surface placeholder-slate-600 focus:border-cyan focus:outline-none focus:ring-1 focus:ring-cyan disabled:cursor-not-allowed disabled:opacity-60";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, ...rest },
  ref
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid ? "true" : undefined}
      className={cn(
        INPUT_BASE,
        invalid && "border-error focus:border-error focus:ring-error/40",
        className
      )}
      {...rest}
    />
  );
});

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ className, invalid, rows = 3, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        rows={rows}
        aria-invalid={invalid ? "true" : undefined}
        className={cn(
          INPUT_BASE,
          "h-auto min-h-[84px] py-2 leading-5",
          invalid && "border-error focus:border-error focus:ring-error/40",
          className
        )}
        {...rest}
      />
    );
  }
);

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export function Label({ children, required, className, ...rest }: LabelProps) {
  return (
    <label
      className={cn(
        "mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant",
        className
      )}
      {...rest}
    >
      {children}
      {required ? <span className="ml-1 text-cyan">*</span> : null}
    </label>
  );
}

export function FieldError({
  children,
  ...rest
}: React.HTMLAttributes<HTMLParagraphElement>) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className="mt-1 text-xs font-medium text-error"
      {...rest}
    >
      {children}
    </p>
  );
}

export function FieldHint({
  children,
  ...rest
}: React.HTMLAttributes<HTMLParagraphElement>) {
  if (!children) return null;
  return (
    <p
      className="mt-1 text-[11px] text-on-surface-variant/70"
      {...rest}
    >
      {children}
    </p>
  );
}

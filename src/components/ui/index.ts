/**
 * Hotfix-F001 · `<ui>` atom barrel.
 *
 * Pages import `from "@/components/ui"` and pick the atoms they need.
 * Components without business semantics live here; anything KOL- or
 * Campaign-aware lives under `@/components/common`.
 */
export { Button, buttonVariants, type ButtonProps, type ButtonVariant, type ButtonSize } from "./Button";
export {
  Input,
  Textarea,
  Label,
  FieldError,
  FieldHint,
  type InputProps,
  type TextareaProps,
  type LabelProps,
} from "./Input";
export { Select, type SelectProps } from "./Select";
export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogPortal,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
  DialogHeader,
  DialogFooter,
} from "./Dialog";
export {
  Table,
  THead,
  TBody,
  TRow,
  TCell,
  type TableProps,
  type TRowProps,
  type TCellProps,
} from "./Table";
export { Checkbox, type CheckboxProps } from "./Checkbox";

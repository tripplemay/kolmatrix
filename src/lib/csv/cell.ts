/**
 * BL-024-F001-1 — shared CSV cell helper with both RFC-4180 quoting
 * and Excel/Google-Sheets formula-injection guards.
 *
 * Why two layers:
 *   1. RFC-4180 quoting (existing BIx F001 behavior) — needed when a
 *      cell contains `,`, `"`, `\n`, or `\r`.
 *   2. Formula-injection prefix — Excel/Google Sheets executes any
 *      cell starting with `=`, `+`, `-`, or `@` as a formula. An
 *      attacker who controls a free-text field (KOL handle, display
 *      name, categories) could inject `=HYPERLINK(...)` or other
 *      formulas. Prepending a single quote (`'`) neutralizes this
 *      while preserving the visible value when imported back. Some
 *      tools also call out tab/CR as injection vectors, so we strip
 *      those out of the prefix detection by trimming leading WS first.
 *
 * Both BIx F001 (`/api/crm/export-csv`) and BL-024-F001 (`/api/database/
 * export-csv`) use this helper so the protection is uniform.
 */
const FORMULA_INJECTION_PREFIXES = /^[\s]*([=+\-@\t\r])/;

/**
 * RFC-4180 quote + Excel/Sheets formula-injection guard.
 *
 * - `null` / `undefined` → empty string
 * - cell starts with `=`/`+`/`-`/`@` (after optional leading WS) →
 *   prepend `'` to neutralize formula execution on import
 * - cell contains `,` `"` `\n` `\r` → wrap in `"..."` and double inner `"`
 */
export function csvCell(value: string | number | null | undefined): string {
  if (value == null) return "";
  let s = String(value);

  if (FORMULA_INJECTION_PREFIXES.test(s)) {
    s = `'${s}`;
  }

  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Convenience: build a CSV row by mapping every cell through `csvCell`. */
export function csvRow(
  cells: ReadonlyArray<string | number | null | undefined>
): string {
  return cells.map(csvCell).join(",");
}

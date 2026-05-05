/**
 * BL-024-F001-2 — minimal RFC-4180 CSV parser (no external dependency).
 *
 * Handles:
 *   - Quoted cells `"…"`
 *   - Embedded commas inside quoted cells
 *   - Escaped quotes (`""` → `"`)
 *   - Newlines inside quoted cells (`\n` and `\r\n`)
 *   - Trailing blank line (ignored)
 *
 * Constraints (acceptable for user-curated KOL imports):
 *   - No streaming — the file fits in memory (5 MB cap upstream).
 *   - First row is treated as the header. Returned `rows` are
 *     header-keyed objects so callers can access fields by name
 *     without column-index assumptions.
 *
 * Does NOT undo the formula-injection prefix `'`. Callers that round-
 * trip an export → import should ensure their consumer (Prisma upsert)
 * compares strings as-is; we don't want to drop a deliberately-leading
 * `'` that the user actually typed.
 */
export interface ParsedCsv {
  /** First row, used as object keys for `rows`. */
  header: string[];
  /** Each entry is `{ [headerKey]: cellValue }`. */
  rows: Array<Record<string, string>>;
}

export class CsvParseError extends Error {
  constructor(message: string, public readonly line: number) {
    super(message);
    this.name = "CsvParseError";
  }
}

function parseRow(input: string, start: number): { cells: string[]; next: number } {
  const cells: string[] = [];
  let i = start;
  let cur = "";
  let inQuotes = false;
  while (i < input.length) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          cur += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cur += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      cells.push(cur);
      cur = "";
      i += 1;
      continue;
    }
    if (ch === "\r") {
      // Treat `\r\n` and bare `\r` as row terminator.
      i += 1;
      if (input[i] === "\n") i += 1;
      cells.push(cur);
      return { cells, next: i };
    }
    if (ch === "\n") {
      i += 1;
      cells.push(cur);
      return { cells, next: i };
    }
    cur += ch;
    i += 1;
  }
  cells.push(cur);
  return { cells, next: i };
}

export function parseCsv(input: string): ParsedCsv {
  // Strip BOM so Excel-saved files don't leak `﻿` into the header.
  const trimmed = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  if (!trimmed.trim()) {
    return { header: [], rows: [] };
  }

  let pos = 0;
  let lineNo = 1;
  const headerRow = parseRow(trimmed, pos);
  pos = headerRow.next;
  const header = headerRow.cells.map((s) => s.trim());

  const rows: Array<Record<string, string>> = [];
  while (pos < trimmed.length) {
    lineNo += 1;
    const r = parseRow(trimmed, pos);
    pos = r.next;
    // Skip fully blank lines (e.g. trailing newline at file end).
    if (r.cells.length === 1 && r.cells[0] === "") continue;
    if (r.cells.length !== header.length) {
      throw new CsvParseError(
        `row has ${r.cells.length} cells, expected ${header.length}`,
        lineNo
      );
    }
    const row: Record<string, string> = {};
    for (let i = 0; i < header.length; i += 1) {
      row[header[i]] = r.cells[i];
    }
    rows.push(row);
  }
  return { header, rows };
}

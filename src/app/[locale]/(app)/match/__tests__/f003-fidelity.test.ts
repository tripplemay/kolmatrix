/**
 * BL-065-F003 · Source-level fidelity guards for the bulk-action +
 * admin-route surfaces.
 *
 * Static greps cheaper than rendering — same pattern as F002
 * fidelity.test.ts. The async server pieces (admin/kol-csv-import/page,
 * the auth-gated /match header) can't easily be rendered in vitest
 * jsdom, but their acceptance is structural.
 */
import { readFileSync } from "fs";
import { resolve } from "path";

import { describe, expect, it } from "vitest";

const MATCH_DIR = resolve(__dirname, "..");
const ADMIN_DIR = resolve(__dirname, "../../../admin/kol-csv-import");
function read(dir: string, relative: string): string {
  return readFileSync(resolve(dir, relative), "utf8");
}

describe("/match bulk-action bar (BL-065-F003)", () => {
  it("ships add-to-campaign, delete, export-csv, clear — every decision-#D action", () => {
    const bar = read(MATCH_DIR, "MatchBulkActionBar.tsx");
    for (const testid of [
      "match-bulk-bar",
      "match-bulk-bar-count",
      "match-bulk-bar-add-to-campaign",
      "match-bulk-bar-export",
      "match-bulk-bar-delete",
      "match-bulk-bar-clear",
    ]) {
      expect(
        bar.includes(`data-testid="${testid}"`),
        `MatchBulkActionBar missing data-testid=${testid}`,
      ).toBe(true);
    }
  });

  it("delete action is wired to ConfirmDeleteDialog (no destructive shortcut)", () => {
    const table = read(MATCH_DIR, "MatchKolTable.tsx");
    expect(table).toMatch(/<ConfirmDeleteDialog\b/);
    expect(table).toMatch(/setDeleteOpen\(true\)/);
    // The bar's onDelete prop must go through the dialog's setOpen.
    expect(table).toMatch(/onDelete=\{\(\) => setDeleteOpen\(true\)\}/);
  });

  it("export CSV builds the file client-side from the selected rows", () => {
    const bar = read(MATCH_DIR, "MatchBulkActionBar.tsx");
    expect(bar).toMatch(/Blob\(\[csv\]/);
    expect(bar).toMatch(/URL\.createObjectURL/);
    expect(bar).toMatch(/`kol-match-export-\$\{ts\}\.csv`/);
    // The CSV is built from selectedRows, not from a server fetch.
    expect(bar).toMatch(/function buildCsv\(rows: MatchKolRow\[\]\)/);
  });

  it("MatchKolTable is the client wrapper that owns selection + dialogs", () => {
    const table = read(MATCH_DIR, "MatchKolTable.tsx");
    expect(table).toMatch(/^"use client";/);
    expect(table).toMatch(/useState<Set<string>>/);
    expect(table).toMatch(/<AddToCampaignDialog\b/);
    expect(table).toMatch(/<MatchBulkActionBar\b/);
    expect(table).toMatch(/<ConfirmDeleteDialog\b/);
    expect(table).toMatch(/data-testid="match-table-wrapper"/);
  });
});

describe("/admin/kol-csv-import route (BL-065-F003)", () => {
  it("guards the page behind isAdminRole and redirects non-admins", () => {
    const page = read(ADMIN_DIR, "page.tsx");
    expect(page).toMatch(/from "@\/lib\/auth\/roles"/);
    expect(page).toMatch(/isAdminRole\(session\.user\.role\)/);
    // Mirror the /admin/apify-preview pattern: non-admin gets sent
    // somewhere safe in the workbench (here: /match).
    expect(page).toMatch(/redirect\(`\/\$\{locale\}\/match`\)/);
    expect(page).toMatch(/redirect\(`\/\$\{locale\}\/login`\)/);
  });

  it("renders the relocated ImportCsvDialog with database.import labels", () => {
    const page = read(ADMIN_DIR, "page.tsx");
    expect(page).toMatch(/from "\.\/ImportCsvDialog"/);
    expect(page).toMatch(/<ImportCsvDialog\b/);
    expect(page).toMatch(/tImport\("uploadLabel"\)/);
    expect(page).toMatch(/data-testid="admin-kol-csv-import-page"/);
  });

  it("ImportCsvDialog physically lives under /admin/kol-csv-import after git mv", () => {
    const dialog = read(ADMIN_DIR, "ImportCsvDialog.tsx");
    // Header doc-comment from the original /database file should
    // travel with the move (git mv preserves history + content).
    expect(dialog).toMatch(/^"use client";/m);
    expect(dialog).toMatch(/export function ImportCsvDialog/);
  });

  it("the /database folder is deleted outright (BL-065-F006 follow-on)", () => {
    // F003 originally checked that /database/page.tsx no longer imported
    // ImportCsvDialog. F006 then deleted the entire /database folder, so
    // the only contract that still makes sense is "no /database files
    // exist at all". Skipped at the path level because resolving a
    // missing directory would throw.
    expect(() => readFileSync(resolve(__dirname, "../../database/page.tsx"))).toThrow();
  });
});

describe("/match admin entry link (BL-065-F003)", () => {
  it("admin-only link to /admin/kol-csv-import sits in the header actions", () => {
    const page = read(MATCH_DIR, "page.tsx");
    expect(page).toMatch(/isAdmin \? \(/);
    expect(page).toMatch(/`\/\$\{locale\}\/admin\/kol-csv-import`/);
    expect(page).toMatch(/data-testid="match-admin-csv-import-link"/);
    expect(page).toMatch(/match\.adminEntry/);
  });

  it("isAdmin gate uses the canonical isAdminRole helper", () => {
    const page = read(MATCH_DIR, "page.tsx");
    expect(page).toMatch(/from "@\/lib\/auth\/roles"/);
    expect(page).toMatch(/isAdminRole\(session\.user\.role\)/);
  });
});

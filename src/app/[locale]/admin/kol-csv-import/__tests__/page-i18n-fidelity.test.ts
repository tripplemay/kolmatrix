/**
 * BL-065-R1 regression guard — /admin/kol-csv-import server render must
 * NOT call next-intl's ICU formatter on the successTemplate /
 * rowErrorTemplate keys.
 *
 * Background: the ImportCsvDialog client component substitutes
 * `{imported}` / `{skipped}` / `{row}` / `{message}` tokens via
 * String.prototype.replace (raw template strings, NOT ICU). Before
 * BL-065-F006 the dialog mounted on /database which middleware 302'd
 * away — the page never actually rendered, so the latent bug stayed
 * dormant. F003 moved the dialog to /admin/kol-csv-import which DOES
 * render, and the call `tImport("successTemplate")` evaluates the
 * unbound `{imported}` placeholder server-side, throwing
 * `FORMATTING_ERROR: variable "imported" was not provided`.
 *
 * Reviewer (Codex) caught this in BL-065 verifying — see signoff §8.5
 * + progress.evaluator_feedback BL-065-R1. The structural fix is
 * `tImport.raw(key)` which bypasses the ICU formatter and returns
 * the literal template string. This test locks the structural fix so
 * a later "lint cleanup" PR can't silently drop `.raw` and re-
 * introduce the runtime error.
 */
import { readFileSync } from "fs";
import { resolve } from "path";

import { describe, expect, it } from "vitest";

const PAGE = resolve(
  __dirname,
  "..",
  "page.tsx",
);

function read(): string {
  return readFileSync(PAGE, "utf8");
}

describe("/admin/kol-csv-import server-render i18n contract (BL-065-R1)", () => {
  it("parameterized templates are fetched via tImport.raw — never the ICU-formatting form", () => {
    const src = read();
    expect(src).toMatch(/successTemplate=\{tImport\.raw\("successTemplate"\)/);
    expect(src).toMatch(/rowErrorTemplate=\{tImport\.raw\("rowErrorTemplate"\)/);
    // The non-raw form would throw next-intl FORMATTING_ERROR on render
    // because `{imported}` / `{skipped}` / `{row}` / `{message}` are
    // unbound ICU placeholders.
    expect(src).not.toMatch(/successTemplate=\{tImport\("successTemplate"\)/);
    expect(src).not.toMatch(/rowErrorTemplate=\{tImport\("rowErrorTemplate"\)/);
  });

  it("plain (non-parameterized) i18n keys keep using tImport() — only the {placeholder} templates need .raw", () => {
    const src = read();
    // Sanity: tImport("title"), tImport("body"), tImport("uploadLabel"),
    // tImport("errorLabel"), tImport("rateLimitLabel"),
    // tImport("fileTooLargeLabel"), tImport("uploadingLabel"),
    // tImport("cancelLabel") are all bare strings without ICU tokens
    // and should NOT be switched to .raw (would lose pluralization /
    // future ICU support).
    for (const k of [
      "title",
      "body",
      "uploadLabel",
      "uploadingLabel",
      "cancelLabel",
      "errorLabel",
      "rateLimitLabel",
      "fileTooLargeLabel",
    ]) {
      expect(
        src.includes(`tImport("${k}")`),
        `expected tImport("${k}") to stay non-raw`,
      ).toBe(true);
    }
  });
});

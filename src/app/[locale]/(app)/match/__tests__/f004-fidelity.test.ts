/**
 * BL-065-F004 · Source-level fidelity guards for the Match-page
 * AddKolDialog mount.
 *
 * Spec §F004 is literally "继承 /database 的 AddKolDialog" + wire it
 * into the /match header. The submission path itself was validated end-
 * to-end by BL-063 (isSaved field write removed) and is unit-tested in
 * /database/__tests__/addKolAction.test.ts (7 cases), so the F004 risk
 * surface is purely the wiring: import path, prop labels, no
 * regression on the underlying action. Static greps cover that
 * efficiently — same pattern as F002 + F003 fidelity tests.
 */
import { readFileSync } from "fs";
import { resolve } from "path";

import { describe, expect, it } from "vitest";

const MATCH_DIR = resolve(__dirname, "..");
const DATABASE_DIR = resolve(__dirname, "../../database");

function read(dir: string, relative: string): string {
  return readFileSync(resolve(dir, relative), "utf8");
}

describe("/match AddKolDialog mount (BL-065-F004)", () => {
  it("page.tsx imports AddKolDialog from /database (re-use, not duplicate)", () => {
    const page = read(MATCH_DIR, "page.tsx");
    expect(page).toMatch(
      /import \{ AddKolDialog \} from "@\/app\/\[locale\]\/\(app\)\/database\/AddKolDialog"/,
    );
    // No /match/AddKolDialog yet — F006 may physically migrate the
    // file together with the rest of the /database deletion, but for
    // F004 the import points at /database to keep the diff minimal.
    expect(page).not.toMatch(
      /import \{ AddKolDialog \} from "\.\/AddKolDialog"/,
    );
  });

  it("page.tsx mounts <AddKolDialog> with the BM1 database.addKolForm + database.header i18n labels", () => {
    const page = read(MATCH_DIR, "page.tsx");
    expect(page).toMatch(/<AddKolDialog\b/);
    // Trigger labels come from database.header (matches /database's
    // own wiring so the button copy stays identical across the two
    // routes during the F002–F006 transition).
    expect(page).toMatch(/triggerLabel=\{tDbHeader\("addKol"\)\}/);
    expect(page).toMatch(/triggerTitle=\{tDbHeader\("addKolTooltip"\)\}/);
    // Form-field labels come from database.addKolForm — same group
    // /database/page.tsx already wires.
    for (const key of [
      "title",
      "platformLabel",
      "handleLabel",
      "handlePlaceholder",
      "displayNameLabel",
      "urlLabel",
      "emailLabel",
      "followerCountLabel",
      "submitLabel",
      "submittingLabel",
      "cancelLabel",
      "successLabel",
      "errorLabel",
      "duplicateLabel",
      "rateLimitLabel",
      "invalidUrlLabel",
      "invalidEmailLabel",
    ]) {
      expect(
        page.includes(`tAddKol("${key}")`),
        `page.tsx missing tAddKol("${key}") wiring`,
      ).toBe(true);
    }
  });

  it("AddKolDialog still calls addKolAction (no submission-path regression)", () => {
    // Guard against accidental refactor of the underlying server
    // action wiring — BL-063 F003 already locked the action to not
    // write isSaved; any future edit that removes the action call
    // should land its own batch with explicit tests.
    const dialog = read(DATABASE_DIR, "AddKolDialog.tsx");
    expect(dialog).toMatch(/from "\.\/actions"/);
    expect(dialog).toMatch(/addKolAction\(/);
    // BL-063 F003 invariant: the dialog must not re-introduce
    // isSaved=true into the addKolAction call site (matches the same
    // guard inside /database/__tests__/addKolAction.test.ts L66).
    expect(dialog).not.toMatch(/isSaved:\s*true/);
  });
});

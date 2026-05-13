/**
 * BL-065-F004 · Source-level fidelity guards for the Match-page
 * AddKolDialog mount.
 *
 * F004 originally inherited /database's AddKolDialog by import. F006
 * then physically migrated the dialog into /match (git mv) so /database
 * could be deleted; this spec now asserts the post-migration shape:
 *   - page.tsx imports AddKolDialog from the local /match folder.
 *   - The full label-prop wiring (database.addKolForm.* → match.addKolForm.*)
 *     is preserved.
 *   - AddKolDialog still calls addKolAction (now resolved against
 *     /match/actions.ts via the relative `./actions` import).
 *   - BL-063 isSaved invariant — no isSaved=true write — stays locked.
 */
import { readFileSync } from "fs";
import { resolve } from "path";

import { describe, expect, it } from "vitest";

const MATCH_DIR = resolve(__dirname, "..");

function read(relative: string): string {
  return readFileSync(resolve(MATCH_DIR, relative), "utf8");
}

describe("/match AddKolDialog mount (BL-065-F004 + F006)", () => {
  it("page.tsx imports AddKolDialog from the local /match folder", () => {
    const page = read("page.tsx");
    expect(page).toMatch(/import \{ AddKolDialog \} from "\.\/AddKolDialog"/);
    // No cross-folder import from /database survives F006.
    expect(page).not.toMatch(
      /from "@\/app\/\[locale\]\/\(app\)\/database\/AddKolDialog"/,
    );
  });

  it("page.tsx mounts <AddKolDialog> with the match.addKolForm + match.headerActions i18n labels", () => {
    const page = read("page.tsx");
    expect(page).toMatch(/<AddKolDialog\b/);
    expect(page).toMatch(/triggerLabel=\{tDbHeader\("addKol"\)\}/);
    expect(page).toMatch(/triggerTitle=\{tDbHeader\("addKolTooltip"\)\}/);
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
    // After the F006 git mv the dialog lives in /match and its `./actions`
    // import resolves to /match/actions.ts (which now owns addKolAction).
    const dialog = read("AddKolDialog.tsx");
    expect(dialog).toMatch(/from "\.\/actions"/);
    expect(dialog).toMatch(/addKolAction\(/);
    // BL-063 F003 invariant: still no isSaved=true write.
    expect(dialog).not.toMatch(/isSaved:\s*true/);
  });
});

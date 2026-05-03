<!-- BL-025-F009.4 + BL-027-F005 · PR template
     Keep this file short — it is reproduced verbatim every time a
     contributor opens a PR. Sections below are the minimum the
     review process expects; remove what doesn't apply rather than
     leaving stub headers. -->

## Summary

<!-- 1-3 bullets: the why, the change, the user-visible effect. -->

## Test plan

<!-- - [ ] Bulleted checklist of how the reviewer (or you) should
       verify this change locally / on staging. -->

## Material Symbols icon changes

<!-- Source: BL-025-F009 + BL-027-F005 · Material Symbols subset guard.
     The prod 字符方框 incident on 2026-05-03 (BL-026 F002 added
     filter_alt + arrow_drop_down statically and shipped without
     re-running the regen script) showed the original "Static usage
     only ⇒ no script needed" path was wrong. ALL icon changes
     (static OR dynamic) must run the script + commit the woff2.
     Tick exactly one of these checkboxes. -->

- [ ] Not applicable — this PR doesn't touch any Material Symbols icon usage.
- [ ] Has icon changes — all of the following must be true:
      - [ ] If a new icon is referenced through a dynamic form (JSX
            ternary, object value with key ≠ `icon`, array element,
            `return "name"` statement, or `?? "name"` fallback), the
            icon was added to
            `scripts/material-symbols-icons-manifest.txt` (one line
            + comment pointing at the call site).
      - [ ] `bash scripts/regenerate-material-symbols-subset.sh` ran
            locally and the resulting
            `src/app/fonts/material-symbols-outlined.woff2` is
            committed alongside this PR — required for static usage
            too, not just dynamic.
      - [ ] `npm run test:integration -- tests/integration/material-symbols-coverage.test.ts`
            passes locally (case #7 verifies woff2 ≡ script output;
            case #6 catches an empty-file regression).

## Notes

<!-- Anything the reviewer needs but doesn't fit above. -->

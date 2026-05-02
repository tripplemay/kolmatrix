<!-- BL-025-F009.4 · PR template
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

<!-- Source: BL-025-F009 · Material Symbols subset guard. The prod
     字符方框 incident traced back to icons that landed in dynamic
     forms the regenerate script's grep didn't catch. Tick exactly
     one of these checkboxes. -->

- [ ] Not applicable — this PR doesn't touch any Material Symbols icon usage.
- [ ] Static usage only — every new icon is referenced via either:
      `<span class="material-symbols-outlined">name</span>` or
      `icon: "name"` / JSX prop `icon="name"` (patterns 1-4 in the
      regenerate script).
- [ ] Dynamic usage — at least one new icon is referenced through:
      a JSX ternary, an object value with key ≠ `icon`, an array
      element, a `return "name"` statement, or a `?? "name"`
      fallback. **In that case all of the following must be true:**
      - [ ] Each new dynamic icon was added to
            `scripts/material-symbols-icons-manifest.txt` (one
            line + comment pointing at the call site).
      - [ ] `./scripts/regenerate-material-symbols-subset.sh` ran
            locally and the resulting
            `src/app/fonts/material-symbols-outlined.woff2` is
            committed alongside this PR.
      - [ ] `tests/integration/material-symbols-coverage.test.ts`
            still passes (ensures no orphan or empty-file regression).

## Notes

<!-- Anything the reviewer needs but doesn't fit above. -->

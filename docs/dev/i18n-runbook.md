# i18n Runbook

This runbook documents how to add UI strings, add a new locale, and
maintain translation quality for KOLMatrix. It is the operational
counterpart to `docs/specs/MVP-i18n-full-locale-spec.md` (the
hotfix that established the toolchain) and lives next to the code
that consumes it.

---

## Stack at a glance

| Concern | Tool |
|---|---|
| Runtime i18n | `next-intl` v4 |
| Routing | `src/i18n/routing.ts` (`localePrefix: "always"`) |
| Source language | `messages/en.json` (canonical, edit by hand) |
| Other locales | `messages/{zh,ja,ko,es}.json` (machine-translated, human-reviewed) |
| Translator | `scripts/i18n-translate.ts` |
| AI gateway | `aigcgateway` |
| Models | `doubao-pro` (zh/ja/ko), `gemini-2.5-flash-lite` (es) |
| Glossary | `docs/i18n/brand-glossary.json` |
| `<html lang>` | `src/app/layout.tsx` reads `getLocale()` from next-intl |
| Static gates | `tests/unit/i18n-{locale-coverage,placeholders,html-tags}.test.ts` |

The 5 supported locales are `en`, `zh`, `ja`, `ko`, `es` — defined
in one place: `routing.locales`.

---

## Adding a new UI string

1. **Add the new key to `messages/en.json`.** This is the only locale
   you ever edit by hand. Follow existing nesting (one section per
   page or feature). Use `{name}` placeholders for variables and ICU
   plural blocks (`{count, plural, one {…} other {…}}`) when the
   string varies by count.

2. **Run the translator** to pick up the new key in every other
   locale:

   ```bash
   npm run i18n:translate -- --target zh
   npm run i18n:translate -- --target ja
   npm run i18n:translate -- --target ko
   npm run i18n:translate -- --target es
   ```

   The script:
   - Reads `messages/en.json` and the target locale.
   - Walks every leaf and selects ones where the locale value still
     equals the en value (i.e. untranslated).
   - Bundles up to ~60 leaves per call to keep each AIGC request
     under the 180 s timeout.
   - Routes zh/ja/ko to the doubao Action and es to the gemini
     Action automatically.
   - Validates that every `{placeholder}`, HTML tag, and ICU plural
     shape is preserved on the way back; rejects + logs the leaf
     when the model drifts.
   - Writes the merged JSON back to `messages/{locale}.json`.
   - Emits `docs/i18n/translate-report-YYYY-MM-DD-{locale}.md`
     with per-section counts, token usage, and skipped paths.

   For a no-spend dry run:

   ```bash
   npm run i18n:translate:dry -- --target zh
   ```

3. **Spot-check the diff.** Open `messages/{locale}.json` in your
   editor, find the new keys via your IDE's "go to definition" or
   `git diff`, and read each translation. Areas worth extra
   attention:
   - HTML tags: `<accent>`, `<br>`, `<strong>` should appear in the
     same order they did in en.
   - Numeric units / dates: ensure the locale convention matches
     (e.g. avoid splitting "10K followers" into separate tokens).
   - Tone register: `dashboard` and `auth` flows want the same
     register the en source has (professional, lightly friendly).

4. **Run the static gates locally:**

   ```bash
   npm test -- --run i18n-
   ```

   These three gates run on every CI build and will catch:
   - missing leaves in any locale (`i18n-locale-coverage`)
   - placeholder or ICU shape drift (`i18n-placeholders`)
   - HTML tag drift (`i18n-html-tags`)

5. **Commit the en + locale changes together.** A locked-in PR
   convention since F006: messages-only commits should not split en
   from non-en. Splitting them creates a window where the gates
   reject CI on the en-only commit because the locales have stale
   content for the new keys.

---

## Adding a new locale

Say you want to add French (`fr`).

1. **Update routing.** Add `"fr"` to `routing.locales` in
   `src/i18n/routing.ts`. Add a Topbar label by adding the `fr` key
   under `topbar.locale` in every existing locale file (this is the
   only place where the locale's display name stays in its own
   spelling — see the `KEEP_AS_EN_PATHS` allowlist note below).

2. **Bootstrap the locale file.** Copy `messages/en.json` to
   `messages/fr.json` so every leaf starts as the en string.

3. **Update glossary.** Open `docs/i18n/brand-glossary.json` and add
   an `fr` field to every entry whose `keep_en` is false. For
   `keep_en: true` entries (KOLMatrix, KOL, AI, etc.) no change
   needed — they stay English in every locale.

4. **Decide the model and create an Action.** Doubao is strong on
   CJK, gemini-flash-lite is broader. For French, gemini is the safe
   default. Either:
   - Reuse `ui-i18n-translate-gemini` (action_id
     `cmogjd1cl020tbnqwicf8rgvh`) and route `fr` to it in
     `actionForLocale()` inside `scripts/i18n-translate.ts`; or
   - Create a new Action via
     `mcp__aigc-gateway__create_action` with the same prompt
     template and a different model (e.g. `gpt-4o-mini`).

5. **Translate.** `npm run i18n:translate -- --target fr` runs the
   script against the new locale. ~810 leaves and ~$0.01 of credit
   later, you have a French file.

6. **Update the static gates.**
   - `tests/unit/i18n-locale-coverage.test.ts` — add `"fr"` to the
     `describe.each` list and audit the
     `KEEP_AS_EN_PATHS` allowlist. Most paths apply to every locale
     unchanged, but a few (game genres, market codes) may translate
     in French where they don't in CJK; remove those paths from the
     allowlist.
   - `tests/unit/i18n-placeholders.test.ts` and
     `tests/unit/i18n-html-tags.test.ts` — add `"fr"` to their
     `describe.each` lists.

7. **Spot-check the topbar switcher.** `LanguageSwitcher` reads
   `routing.locales` directly, so the new locale appears
   automatically. Confirm the cookie + URL switch and the
   `<html lang="fr">` attribute updates on navigation.

---

## Glossary maintenance

`docs/i18n/brand-glossary.json` is the single source of truth for:

- which terms must stay English in every locale (`keep_en: true`)
- preferred translations for product/business nouns when keep-en
  is false

Each entry has: `en`, `keep_en`, `category`, optional notes, and one
field per locale (`zh`, `ja`, `ko`, `es`).

When the marketing team finalises a new product noun (e.g. "Reach
Forecast"), add it to the glossary BEFORE the next translator run.
The script forwards the entire glossary to the model on every call,
so any new term is honoured immediately.

---

## Translation quality grading

When reviewing diffs, grade each batch:

| Grade | Meaning | Action |
|---|---|---|
| **A** | Native quality, idiomatic, ready to ship | Commit as-is |
| **B** | Smooth, slightly literal in places, ships for demos | Commit, log spots in backlog |
| **C** | Literal / stiff but understandable | Commit, raise priority for human pass |
| **D** | Wrong tone, broken syntax, mis-translated brand term | Re-translate (consider model swap) |

The MVP threshold is:
- **zh: A** — primary user, native speaker review on every batch
- **ja / ko / es: B** — acceptable for demo / soft-launch; manual
  re-pass scheduled before a hard launch

---

## Model routing

| Locale | Action | Model | Strengths |
|---|---|---|---|
| zh | `ui-i18n-translate-doubao` (cmogjcqsg0001bnrbq3r7c4o6) | doubao-pro | ByteDance, native Chinese register handling |
| ja | `ui-i18n-translate-doubao` (cmogjcqsg0001bnrbq3r7c4o6) | doubao-pro | Strong Japanese です/ます register switching |
| ko | `ui-i18n-translate-doubao` (cmogjcqsg0001bnrbq3r7c4o6) | doubao-pro | Korean 습니다/해요 register selection |
| es | `ui-i18n-translate-gemini` (cmogjd1cl020tbnqwicf8rgvh) | gemini-2.5-flash-lite | Wider Western-language coverage |

Upgrade considerations:
- **Higher quality at higher cost:** swap the model in the Action
  to `deepseek-v4-pro` ($1.74 in / $3.48 out per 1M) or
  `claude-sonnet-4.6` for delicate marketing copy. Acceptable when
  the bill is < $1 / batch.
- **Different model per locale:** create a new Action and add a
  branch to `actionForLocale()` in `scripts/i18n-translate.ts`.
  Don't try to pass `model` as a runtime variable — Actions are
  model-bound at creation in aigcgateway.

---

## Common pitfalls

- **Don't translate brand terms.** The glossary's `keep_en: true`
  entries are non-negotiable. The post-translate validator catches
  most drift, but if a model wraps a brand term as `{KOL}` or
  `{ROI}` (placeholder syntax), the validator rejects the leaf and
  flags it in the report. When this happens for a small set of
  leaves, patch by hand rather than re-running the whole batch.

- **`format.relativeTime(now: new Date())` is non-deterministic.**
  Server components that render relative dates will produce different
  pixels every day. Mask the surrounding region in any visual
  baseline — see the F005 lesson in
  `docs/test-reports/MVP-visual-fidelity-hotfix-signoff-2026-04-27.md`.

- **next-intl reserves `.` in keys.** Don't use audit_log dot-string
  paths (`campaign.kol.added`) as i18n leaf keys. Use underscores
  (`campaign_kol_added`) and map at the call site — see the F005
  fix `commit 99c3045`.

- **Long Spanish strings.** Spanish prose averages 20–30% longer
  than English. Test campaigns / dashboard table headers manually
  in the language switcher; add `truncate` or `whitespace-nowrap`
  in the page CSS if a header wraps unexpectedly.

- **Local `.env` points at localhost:4000.** The translator script
  hard-codes the public URL by default to bypass the local stub.
  Set `I18N_TRANSLATE_USE_LOCAL_GATEWAY=1` to opt back into reading
  `AIGCGATEWAY_BASE_URL` from the env.

---

## Quick reference

```bash
# Audit which locales have untranslated keys
node -e "
const fs=require('fs');
const en=JSON.parse(fs.readFileSync('messages/en.json'));
function* L(o,p=[]){if(typeof o==='string'){yield{p,v:o};return}
  if(typeof o==='object'&&o)for(const k of Object.keys(o))yield*L(o[k],[...p,k])}
function get(o,p){let c=o;for(const k of p){if(!c)return;c=c[k]}return c}
const enL=[...L(en)];
for(const l of ['zh','ja','ko','es']){
  const t=JSON.parse(fs.readFileSync(\`messages/\${l}.json\`));
  let same=0;for(const{p,v} of enL)if(get(t,p)===v)same++;
  console.log(\`\${l}: \${same} same-as-en\`);
}"

# Translate one locale (live)
npm run i18n:translate -- --target zh

# Dry-run (no API spend)
npm run i18n:translate:dry -- --target ja

# Translate just one section
npm run i18n:translate -- --target ko --section dashboard

# Limit leaves per run (smoke testing)
npm run i18n:translate -- --target es --max-leaves 20

# Run the gate tests
npm test -- --run i18n-

# Render the high-resolution Stitch previews (unrelated, but co-located in scripts/)
npm run render:stitch-previews
```

---

Last updated: 2026-04-27 (MVP-i18n-full-locale F007).

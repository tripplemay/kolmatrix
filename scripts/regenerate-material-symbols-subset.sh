#!/bin/bash
#
# Regenerate src/app/fonts/material-symbols-outlined.woff2 with a
# subset that exactly matches the Material Symbols icons currently
# referenced in src/.
#
# When to run: any time you add a new `<span class="material-symbols-
# outlined">new_icon</span>` callsite or a new `icon: "new_icon"`
# constant. CI doesn't (yet) auto-regenerate; the BIx-mvp-polish-pass
# F005-B comment in `src/app/layout.tsx` is the source of truth on
# how this is wired.
#
# Output: 8KB-ish woff2 with only the 60-ish icons we use, served by
# next/font/local.
#
# Usage: ./scripts/regenerate-material-symbols-subset.sh
#
# References:
# - https://developers.google.com/fonts/docs/material_symbols
# - docs/specs/BIx-mvp-polish-pass-spec.md §F005 Part B

set -euo pipefail

cd "$(dirname "$0")/.."

OUT_FONT="src/app/fonts/material-symbols-outlined.woff2"
TMP_LIST="$(mktemp)"
TMP_CSS="$(mktemp)"
trap 'rm -f "$TMP_LIST" "$TMP_CSS"' EXIT

MANIFEST_FILE="scripts/material-symbols-icons-manifest.txt"

# Pattern 1: same-line `<span class="material-symbols-outlined ...">icon_name</span>`
{
  grep -rohE 'material-symbols-outlined[^>]*>\s*[a-z_][a-z_0-9]*\s*<' src/ \
    | grep -oE '>\s*[a-z_][a-z_0-9]*\s*<' \
    | sed 's/^>\s*//; s/\s*<$//'

  # Pattern 2: multi-line — span tag opens, icon name on next line
  grep -rE 'material-symbols-outlined' src/ -A 1 --no-filename \
    | grep -E '^\s*[a-z_][a-z_0-9]*\s*$' \
    | tr -d ' \t'

  # Pattern 3: TypeScript constant `icon: "name"` (audit log meta, sidebar nav, etc.)
  grep -rohE '\bicon:\s*"[a-z_][a-z_0-9]*"' src/ \
    | grep -oE '"[a-z_][a-z_0-9]*"' \
    | tr -d '"'

  # Pattern 4: JSX prop `icon="name"` (covers MenuItem / ChipRow / KpiStrip / etc.
  # — the script's biggest historical blind spot per 2026-05-02 Planner sweep)
  grep -rohE '\bicon="[a-z_][a-z_0-9]*"' src/ \
    | grep -oE '"[a-z_][a-z_0-9]*"' \
    | tr -d '"'

  # Pattern 5: explicit manifest of icon names that all grep heuristics miss
  # (JSX ternary in expression position, object value with key !== "icon",
  # array elements, function return statements, ?? fallback strings).
  # Maintained by hand: append icons + comment when adding a new dynamic
  # callsite. Script tolerates missing file (fresh checkout / pre-2026-05-02
  # branches) by skipping silently.
  #
  # BL-025-F009 sweep retro: aggressive patterns 6 (array elements) +
  # 7 (return statements) tested at ~219 false-positive matches vs ~88
  # legitimate icons; the manifest+grep mix tracks reality more
  # cleanly than yet-more-permissive grep. New dynamic callsites
  # (multi-line array literals, return "icon" in non-icon-named
  # functions, ?? fallback strings) keep landing in
  # scripts/material-symbols-icons-manifest.txt with a one-line
  # comment pointing back at the call site.
  if [ -f "$MANIFEST_FILE" ]; then
    sed -E 's/[[:space:]]*#.*$//' "$MANIFEST_FILE" \
      | grep -E '^[a-z_][a-z_0-9]+$' || true
  fi

  # Pattern 6 (BL-072-F005): bounded-context grep — scan ±5 lines around
  # each `material-symbols-outlined` reference for quoted lowercase
  # identifiers. Catches Pattern 5a (JSX ternary), 5b (object value),
  # 5e (?? fallback) without the noise of the F009 whole-file scan.
  # The cluster heuristic works because real icon literals live near
  # their host span (`<span class="material-symbols-outlined">` or
  # `className={\`material-symbols-outlined …\`}`). Catches `table_rows`
  # in match/MatchSummaryBar.tsx:98 `{v === "card" ? "grid_view" : "table_rows"}`
  # naturally — manifest entry for table_rows would be redundant once
  # Pattern 6 is in place, but is kept as belt-and-suspenders.
  #
  # False-positive exclusion runs in the final sort -u stage below.
  grep -rln --include='*.tsx' --include='*.ts' 'material-symbols-outlined' src/ \
    | while IFS= read -r p6_file; do
        for p6_ln in $(grep -n 'material-symbols-outlined' "$p6_file" | cut -d: -f1); do
          p6_start=$(( p6_ln > 5 ? p6_ln - 5 : 1 ))
          p6_end=$(( p6_ln + 5 ))
          sed -n "${p6_start},${p6_end}p" "$p6_file"
        done
      done \
    | grep -oE "['\"][a-z][a-z_0-9]{2,40}['\"]" \
    | tr -d "'\""

  # Pattern 7 (BL-073-F002): bare ligature on its own line within a
  # multi-line `<span className="material-symbols-outlined …">` block.
  # BL-073 prod-hotfix root cause: when className spans 2-3 lines (CSS
  # variant + style prop + aria), the ligature lands well past `-A 1`
  # so Pattern 1's multi-line grep misses it; Pattern 6 only sees
  # quoted strings so bare identifiers on their own line slip past.
  # Example shape:
  #
  #     <span
  #       className={cn(
  #         "material-symbols-outlined ...",
  #         ...
  #       )}
  #       aria-hidden
  #     >
  #       forward_to_inbox          <-- bare, own line, Pattern 7 catches
  #     </span>
  #
  # Filters: keep only lines whose entire content is a single
  # `[a-z_][a-z_0-9]+` token after stripping whitespace. Then run
  # through the false-positive exclusion below to drop JSX prop names
  # / HTML element identifiers / boolean tokens.
  grep -rln --include='*.tsx' --include='*.ts' 'material-symbols-outlined' src/ \
    | while IFS= read -r p7_file; do
        for p7_ln in $(grep -n 'material-symbols-outlined' "$p7_file" | cut -d: -f1); do
          p7_end=$(( p7_ln + 12 ))
          sed -n "${p7_ln},${p7_end}p" "$p7_file"
        done
      done \
    | grep -E '^[[:space:]]+[a-z][a-z_0-9]+[[:space:]]*$' \
    | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//'
# False-positive exclusion list — extended for BL-072-F005 Pattern 6
# and BL-073-F002 Pattern 7 (same list serves both — single source of
# truth, not forked, per BL-073 spec §2.3 invariant #3).
# Original BL-025 list was just `cyan|purple|neutral|campaign_*` (audit-log
# action verbs Pattern 3 grabs). Pattern 6's ±5-line context grep adds
# JSX attribute values (`role="status"`, `type="email"`), Tailwind tone
# names (`tone="danger"`), and HTML element identifiers near icon spans.
# Words removed from the original spec list because they ARE real Material
# Symbols icons in this codebase: delete (AssetCard menu item), error
# (ChipRow icon prop), info (recent-activity audit entry), warning
# (RoiInsightsPanel tone return), table (no — kept-en for `table_rows`).
} | sort -u | grep -vE '^(cyan|purple|neutral|blue|red|green|amber|pink|yellow|black|white|gray|grey|inherit|currentColor|transparent|true|false|undefined|null|sm|md|lg|xl|xs|left|right|top|bottom|center|start|end|grid|swap|email|body|cta|h2|h3|h4|title|truncate|invisible|normal|platforms|card|table|duplicate|offline|on|off|outline|filled|sharp|rounded|active|inactive|disabled|enabled|hidden|visible|alert|status|danger|ghost|secondary|primary|menuitem|menubar|button|listbox|dialog|tab|tabpanel|role|item|assets|get|lazy|round|square|none|auto|both|all|hover|focus|stroke|fast|slow|new|old|nav|aside|footer|loading|dashboard|reports|analytics|en|zh|ja|ko|es|prod|dev|staging|local|test|api|web|small|medium|large|tiny|huge|wide|narrow|tall|short|thick|thin|ai_generated|campaign_created|campaign_kol_added|campaign_kol_removed|campaign_kol_fee_updated|campaign_kol_status_changed|campaign_status_changed|campaign_revenue_recorded|kol_bulk_added_to_campaign|campaigns|img|submit|invalid|select|input|form|reset|readonly|required|placeholder|label)$' > "$TMP_LIST"

ICON_COUNT=$(wc -l < "$TMP_LIST" | tr -d ' ')
echo "[regenerate-material-symbols-subset] discovered $ICON_COUNT unique icons"
echo "[regenerate-material-symbols-subset] icons:"
sed 's/^/  - /' "$TMP_LIST"

ICONS=$(paste -sd, "$TMP_LIST")
URL="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined&icon_names=${ICONS}&display=swap"

# Modern UA so Google Fonts serves woff2 (not legacy ttf)
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

curl -sS "$URL" -A "$UA" > "$TMP_CSS"

WOFF_URL=$(grep -oE 'https://fonts\.gstatic\.com/[^)]+' "$TMP_CSS" | head -1)
if [ -z "$WOFF_URL" ]; then
  echo "[regenerate-material-symbols-subset] ERROR: Google Fonts returned no woff2 URL" >&2
  cat "$TMP_CSS" >&2
  exit 1
fi

echo "[regenerate-material-symbols-subset] fetching subset woff2 from Google Fonts ..."
curl -sS -o "$OUT_FONT" "$WOFF_URL"

NEW_SIZE=$(wc -c < "$OUT_FONT" | tr -d ' ')
echo "[regenerate-material-symbols-subset] wrote $OUT_FONT (${NEW_SIZE} bytes)"
echo "[regenerate-material-symbols-subset] commit alongside any new icon usage."

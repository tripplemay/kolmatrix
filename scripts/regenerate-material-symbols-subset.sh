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
} | sort -u | grep -vE '^(cyan|purple|neutral|campaign_created|campaign_kol_added|campaign_kol_removed|campaign_kol_fee_updated|campaign_kol_status_changed|campaign_status_changed|campaign_revenue_recorded|kol_bulk_added_to_campaign|campaigns)$' > "$TMP_LIST"

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

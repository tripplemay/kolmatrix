# BL-030 — Deploy Checklist

> Companion to `docs/specs/BL-030-kb-asset-bridge-migration-spec.md`. Runs the
> end-to-end staging verification + the prod cutover. The user (operator)
> drives prod via SSH; Generator+Reviewer drive staging via the GitHub Actions
> CI green path.

## Pre-flight (before staging deploy)

- [ ] CI green on the latest BL-030 commit (`gh run list --limit 1 --branch main`)
- [ ] No new Prisma migrations in this batch — schema is unchanged. Skip
      `prisma migrate deploy` step.

## Staging — Generator runs this before flipping `progress.json` to `verifying`

```bash
ssh tripplezhou@34.180.93.185
cd /opt/kolmatrix-staging
set -a && source .env.staging && set +a
git pull --ff-only origin main
npm ci --include=dev                                # NODE_ENV=production needs --include=dev (BL-013 教训)
NODE_OPTIONS='--max-old-space-size=4096' GIT_SHA=$(git rev-parse --short HEAD) npm run build
pm2 reload kolmatrix-staging --update-env
```

Verify:

```bash
curl -sS https://staging.kol.guangai.ai/api/health | jq '.git_sha, .db'
# git_sha must equal $(git rev-parse --short HEAD) on main; db: "ok"
```

Note this in `progress.json` `session_notes` as `[staging deployed @ {git_sha} @ {timestamp}]`.

## Staging E2E (Reviewer L2 — spec §7.4)

Three browser checks against `https://staging.kol.guangai.ai`:

1. **KB → /assets bridge**
   - Sign in (marketer@kolmatrix.local / KOLM@2026!).
   - `/knowledge-base` → click "+ New Product".
   - Fill in name + USP, leave "Generate AI assets immediately" checked.
   - Submit → wait 5–10s for the chip to flip from `Generating…` to a
     `3 email templates` / `2 video scripts` chip pair.
   - Click `/assets` in the side nav → 5 new Asset rows visible
     (3 type=email + 2 type=video_script, productName prefix matches the
     new product, `Source` column shows `AI`).

2. **Composer surface**
   - `/outreach` → New campaign → composer view.
   - Product filter → pick the new product.
   - Email template dropdown shows the 3 KB-generated emails (Initial
     outreach / Follow-up / Signing invitation).

3. **Backfill dry-run on staging**
   - SSH staging:
     ```bash
     cd /opt/kolmatrix-staging
     npx tsx scripts/migrate-product-aiassets-to-asset.ts
     ```
   - Expected stdout: `Mode: DRY-RUN`, `Products scanned: 0` (staging is
     fresh post-BL-030 generation, so nothing legacy to migrate).
   - If staging has legacy aiAssets content from earlier seed, run with
     `--execute` and verify counts match.

## Prod cutover — user runs this manually

> **Pre-flight must pass:** CI green + Reviewer signoff on this batch.

### Step 1 — DB backup (always)

```bash
ssh tripplezhou@34.180.93.185
sudo -u postgres pg_dump -d kolmatrix -t product -t asset \
  > /opt/kolmatrix-backups/bl-030-pre-backfill-$(date +%Y%m%d-%H%M).sql
ls -lh /opt/kolmatrix-backups/bl-030-pre-backfill-*.sql
```

### Step 2 — GitHub Actions deploy

GitHub UI → Actions → "Deploy to Production" → Run workflow → main.

Verify within 5–10 min:

```bash
curl -sS https://kol.guangai.ai/api/health | jq '.git_sha, .db'
# git_sha must equal HEAD of main; db: "ok"
```

### Step 3 — Backfill dry-run on prod

```bash
ssh tripplezhou@34.180.93.185
cd /opt/kolmatrix
npx tsx scripts/migrate-product-aiassets-to-asset.ts
```

Expected stdout (prod has 5 legacy products per Planner's 2026-05-04 DB
inspection):

```
[BL-030-F003 backfill] Mode: DRY-RUN (no DB writes)
[BL-030-F003 backfill] Scanned 5 product(s) with legacy aiAssets content
[BL-030-F003 backfill] product=cmomf69bw00042pbn4rix3zls (Clash Royale, tenant=2b1dcaa2-…) would migrate
[BL-030-F003 backfill] product=cmomf69br00032pbnqn1vzg7x (Pokemon Go, tenant=2b1dcaa2-…) would migrate
… (3 more)

[BL-030-F003 backfill] === Summary ===
  Mode:                 DRY-RUN
  Products scanned:     5
  Products completed:   5
  Email assets:         <N> would create / 0 skipped
  Video assets:         <M> would create / 0 skipped
```

Per spec §1 the expected aggregate count is `35` rows total across the
5 products; if the legacy aiAssets has been regenerated more than once
the count can be higher. Verify the per-product output names match
spec §3.1 (Initial outreach / Follow-up / Signing invitation /
YouTube 60s / TikTok 15s) before promoting to --execute. STOP if
`Products scanned ≠ 5` or any product reports `FAILED`.

### Step 4 — Backfill --execute on prod

```bash
npx tsx scripts/migrate-product-aiassets-to-asset.ts --execute
```

Expected:

```
[BL-030-F003 backfill] === Summary ===
  Mode:                 EXECUTE
  Products scanned:     5
  Products completed:   5
  Products failed:      0
  Email assets:         <N> created / 0 skipped
  Video assets:         <M> created / 0 skipped
  Products shrunk:      5
```

Numbers (`<N>`, `<M>`) should match the dry-run output one-for-one.
Per spec §1 the user observed 35 stranded items across the 5 products;
the actual count depends on how many times each product has been
regenerated through the legacy KB path.

### Step 5 — Browser verification

Three browser checks against `https://kol.guangai.ai`:

1. **/knowledge-base** — 5 product cards each show `3 email templates` /
   `2 video scripts` chips (counts come from Asset table now).

2. **/assets** — new Asset rows visible (filter by Source=AI, or
   product filter on each of the 5 products → ≥ 5 rows per product
   minimum, more if any product was regenerated).
   Names follow spec §3.1: `{productName} — Initial outreach` /
   `Follow-up` / `Signing invitation` / `YouTube 60s` / `TikTok 15s`.

3. **/outreach composer** — Pick "Clash Royale" in the product filter
   → 3 KB-generated emails appear in the template dropdown.

### Step 6 — Idempotency sanity check

```bash
npx tsx scripts/migrate-product-aiassets-to-asset.ts --execute
```

Expected: `Products scanned: 0` — products no longer match the SELECT
predicate because their aiAssets has been shrunk. Total Asset count
unchanged. Confirms the migration is durable.

## Known prod product ids (2026-05-04 captured by Planner)

All under tenant `2b1dcaa2-f35a-4188-8ff6-82453f39e3d5`:

| product id | name |
|---|---|
| `cmomf69bw00042pbn4rix3zls` | Clash Royale |
| `cmomf69br00032pbnqn1vzg7x` | Pokemon Go |
| `cmomf69bf00022pbnen1pw3lz` | PUBG Mobile |
| `cmomf69b300012pbnyieorz9c` | Genshin Impact |
| `cmomf69am00002pbnvswtfep3` | Honor of Kings |

## Rollback (if --execute goes wrong)

```bash
ssh tripplezhou@34.180.93.185
sudo -u postgres psql -d kolmatrix -c "
  DELETE FROM asset
  WHERE source = 'ai_generated'
    AND metadata->'backfilledFrom' IS NOT NULL;
"
sudo -u postgres psql -d kolmatrix < /opt/kolmatrix-backups/bl-030-pre-backfill-*.sql
```

The DELETE peels every backfill-created Asset (idempotent — safe to
re-run). The pg_dump restore brings back the legacy
Product.aiAssets.emailTemplates / videoScripts JSON for the 5 products.
After rollback, `git revert` BL-030 commits and redeploy to restore the
old code path.

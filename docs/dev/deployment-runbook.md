# Deployment Runbook

> **Audience:** on-call operator responding to a production incident
> when GitHub Actions is unavailable, a deploy has half-landed, or a
> subsystem is misbehaving. The happy-path deploy goes through
> `.github/workflows/deploy-prod.yml` — everything here is fallback.
>
> See `docs/specs/BI2-deployment-automation-spec.md` for the full BI2
> design.

## PM2 quick reference

`ecosystem.config.js` lives at the repo root and defines the `kolmatrix`
app (and, later, the `kolmatrix-worker` stub). All PM2 commands below are
run as the deploy user on the VPS, from `/opt/kolmatrix`.

### First-time bootstrap (once per VPS)

```bash
cd /opt/kolmatrix
pm2 start ecosystem.config.js
pm2 save
pm2 startup   # prints a `sudo env PATH=... pm2 ...` command.
              # run that command, then re-run `pm2 save` so the
              # process list survives reboots.
```

### Deploy-time zero-downtime reload

```bash
pm2 reload kolmatrix --update-env
```

`reload` (not `restart`) keeps listening sockets open while it rotates
workers, so in-flight requests aren't dropped. `--update-env` re-reads
`.env.production` (mandatory after a secret rotation).

### Day-to-day ops

| Command                                | Purpose                                                 |
| -------------------------------------- | ------------------------------------------------------- |
| `pm2 status`                           | one-liner table of every managed process                |
| `pm2 logs kolmatrix`                   | tail combined stdout/stderr (live)                      |
| `pm2 logs kolmatrix --lines 200 --err` | last 200 error lines only                               |
| `pm2 describe kolmatrix`               | full metadata (RSS, restarts, uptime, env)              |
| `pm2 reload kolmatrix`                 | zero-downtime reload (no env change)                    |
| `pm2 restart kolmatrix`                | hard restart (drops in-flight requests — prefer reload) |
| `pm2 stop kolmatrix`                   | stop without removing from list                         |
| `pm2 delete kolmatrix`                 | remove from PM2 entirely                                |

### Log files

```
/var/log/pm2/kolmatrix-out.log
/var/log/pm2/kolmatrix-error.log
```

These are merged with a `YYYY-MM-DD HH:mm:ss Z` timestamp prefix. A
system logrotate config (BI4 scope) will cap them.

## Verifying zero-downtime reload

During a deploy, we assume `pm2 reload --update-env` doesn't drop
requests. The canonical way to prove this on the VPS is a curl loop:

```bash
# Terminal A — hammer / once per second
while true; do
  curl -s -o /dev/null -w "%{http_code} " https://kol.guangai.ai/api/health
  sleep 1
done

# Terminal B — perform the reload
pm2 reload kolmatrix --update-env
```

Expected: terminal A emits an unbroken stream of `200`s across the
reload window. Any `502`/`503`/connection-reset indicates the socket
handoff regressed and needs investigation before the deploy is trusted.

## Backups (scripts/backup-db.sh)

`scripts/deploy-prod.sh` invokes this before every deploy. Output goes
to `/opt/kolmatrix-backups/db-YYYYMMDD-HHMMSS.sql.gz` (created if
missing) plus an append-only `manifest.log` line
`<timestamp> <git SHA> <filename>` so any backup can be mapped back
to the commit it was taken against.

Skip the backup (not recommended) by triggering the deploy workflow
with `skip_backup: true`.

**Cron retention.** Add this line on first-time VPS bootstrap
(run `crontab -e` as the deploy user):

```cron
0 4 * * * find /opt/kolmatrix-backups -name 'db-*.sql.gz' -mtime +30 -delete
```

Files older than 30 days are pruned every night at 04:00 local time.
`manifest.log` itself is never truncated; tail it when you need history
past the backup retention window.

Manual restore (from any surviving `db-*.sql.gz`):

```bash
# DB 名固定为 kolmatrix（init migration 硬编码）
# 强烈建议先恢复到临时库 kolmatrix_restore_smoke 核对数据后再 rename，
# 禁止直接覆盖 prod 库（见 §DB restore 段落）
sudo systemctl stop kolmatrix        # or `pm2 stop kolmatrix`
set -a; source /opt/kolmatrix/.env.production; set +a
gzip -dc /opt/kolmatrix-backups/db-<timestamp>.sql.gz \
  | psql "${DATABASE_ADMIN_URL%%\?*}"
sudo systemctl start kolmatrix       # or `pm2 start ecosystem.config.js`
```

See `docs/specs/BI2-deployment-automation-spec.md §F004` for the
broader design.

## SSH emergency access

```bash
# From your workstation — deploy key, NOT the general dev key:
ssh -i ~/.ssh/id_ed25519_kolmatrix_deploy deploy@kol.guangai.ai
# or via host IP (see .auto-memory/environment.md):
ssh -i ~/.ssh/id_ed25519_kolmatrix_deploy tripplezhou@34.180.93.185
```

If SSH itself is broken, use the cloud provider's serial console
(GCP → Compute Engine → VM instance → CONNECT → Serial console) as
last resort. `sudo` is authed by user password; keep it in the team
vault.

## Manual deploy fallback (GitHub Actions unavailable)

Use this when Actions is down, a secret has rotated mid-deploy, or
you just need to ship a hotfix from your laptop. The ordering mirrors
`scripts/deploy-prod.sh` step-for-step; don't skip any.

```bash
ssh deploy@kol.guangai.ai
cd /opt/kolmatrix

# 1) record current SHA so rollback.sh has a target
PREV_SHA=$(git rev-parse HEAD)
echo "$PREV_SHA" > /tmp/prev-sha

# 2) backup the DB (skip only if you know why)
./scripts/backup-db.sh

# 3) fetch + check out the new code
git fetch --all --prune
git checkout <new-sha-or-main>

# 4) dependencies
npm ci --production=false

# 5) migrations — if this fails, STOP and read §Migration failure below
npx prisma migrate deploy

# 6) build
npm run build

# 7) zero-downtime reload
pm2 reload kolmatrix --update-env

# 8) verify
./scripts/healthcheck.sh
```

If step 8 fails, jump to §Manual rollback.

## Health check debug

`/api/health` returns a JSON body regardless of whether it flips to
503 — look at the `checks` field to localize the failure:

```bash
curl -s https://kol.guangai.ai/api/health | jq .
```

| Field                                                   | What broke                         | First thing to check                                                                                       |
| ------------------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `checks.database.status == "error"`                     | Postgres unreachable or slow       | `sudo systemctl status postgresql` on the DB host; `pg_isready`; check `DATABASE_URL` in `.env.production` |
| `checks.database.error` includes `timeout after 1500ms` | DB is up but `SELECT 1` still slow | open connections (`pg_stat_activity`); check if a long transaction is blocking                             |
| `checks.redis.status != "stub"`                         | Only meaningful once B5 lands      | n/a during BI2                                                                                             |
| `status:"unhealthy"` but `checks` all ok                | bug in route handler               | `pm2 logs kolmatrix` for the stack trace                                                                   |
| HTTP 502 / connection reset / 000                       | PM2 process isn't listening        | `pm2 describe kolmatrix` — look at `status`, `restarts`, last `error_file` lines                           |

Quick tail of the last 200 error-log lines:

```bash
pm2 logs kolmatrix --lines 200 --err --nostream
```

## Manual rollback

Triggered automatically when `deploy-prod.sh` sees a failing
healthcheck; run these manually only if the auto-rollback itself
failed (exit code 2) or you caught a regression post-deploy.

```bash
ssh deploy@kol.guangai.ai
cd /opt/kolmatrix

# Either reuse the SHA that deploy-prod.sh wrote to /tmp/prev-sha:
./scripts/rollback.sh

# …or check out a specific SHA by hand:
PREV_SHA=<good-sha>
git checkout "$PREV_SHA"
npm ci --production=false
npm run build
pm2 reload kolmatrix --update-env
sleep 3
./scripts/healthcheck.sh
```

**Note:** `rollback.sh` never reverts the database. If the failed
deploy ran a destructive migration (column drop, table rename),
reverting the app SHA alone will leave Prisma pointing at a schema it
can't understand. Decide between:

1. Running the migration's `-- ROLLBACK:` recipe (every migration in
   `prisma/migrations/*/migration.sql` carries one, enforced by
   `scripts/validate-rollback-sql.sh`), then rollback.sh again.
2. `pg_restore`-ing from the most recent `/opt/kolmatrix-backups/`
   dump (see next section). This loses any writes since the dump —
   weigh it against the severity of the regression.

## DB restore from backup (`pg_restore`)

> **DB 名固定：`kolmatrix`**（init migration `20260418010000_app_role` 硬编码
> `GRANT CONNECT ON DATABASE kolmatrix`；勿用 `kolmatrix_prod`）。
> **安全第一：** 先恢复到临时库 `kolmatrix_restore_smoke` 验证，再手动 rename。
> 直接 pipe 到 prod 库会覆盖未备份的写入，失职。

```bash
ssh tripplezhou@34.180.93.185

# Find the right backup (manifest.log is append-only):
tail /opt/kolmatrix-backups/manifest.log
ls -lh /opt/kolmatrix-backups/db-*.sql.gz

# 1. Load admin URL from env
set -a; source /opt/kolmatrix/.env.production; set +a
ADMIN_URL="${DATABASE_ADMIN_URL%%\?*}"

# 2. Smoke-restore to a throwaway DB first
createdb -T template0 kolmatrix_restore_smoke
SMOKE_URL="${ADMIN_URL/\/kolmatrix/\/kolmatrix_restore_smoke}"
gzip -dc /opt/kolmatrix-backups/db-<timestamp>.sql.gz | psql "$SMOKE_URL"
psql "$SMOKE_URL" -c 'SELECT COUNT(*) FROM tenant;'   # 非零即数据回来了

# 3. 决定了再覆盖 prod（只有确认 smoke 正常后）
pm2 stop kolmatrix
psql "$ADMIN_URL" -c 'DROP DATABASE IF EXISTS kolmatrix_old;'
psql "$ADMIN_URL" -c 'ALTER DATABASE kolmatrix RENAME TO kolmatrix_old;'
psql "$ADMIN_URL" -c 'ALTER DATABASE kolmatrix_restore_smoke RENAME TO kolmatrix;'
pm2 start ecosystem.config.js
./scripts/healthcheck.sh

# 4. 旧库留 48h 再删（留二次后悔窗口）
# psql "$ADMIN_URL" -c 'DROP DATABASE kolmatrix_old;'
```

If the dump is huge and `psql` is slow, consider `pg_restore -j 4`
after switching `backup-db.sh` to the custom format (`pg_dump -Fc`).
That's a future-scope change; current dumps are plain text so `psql`
is the tool.

## Common errors (encountered in prod)

### 1. OOM — PM2 restarts `kolmatrix` in a loop

Symptom: `pm2 describe kolmatrix` shows `restart_time` climbing
minute-over-minute, `status: online/errored` flapping, `/api/health`
intermittently 503.

Why: `max_memory_restart: 1G` kicks in every time Node passes that
RSS. Normal Next prod well under 1G; loop usually means a leaked
handler (e.g. Prisma client instantiated per request instead of
reused) or a memory-heavy request path.

Fix:

```bash
# confirm it's memory, not CPU:
pm2 describe kolmatrix | grep -E 'restart|memory'

# look at what the last process printed before dying:
pm2 logs kolmatrix --err --lines 400 --nostream

# temporary bandaid — raise the cap to 2G while you patch:
# edit ecosystem.config.js → max_memory_restart: "2G"
pm2 reload kolmatrix --update-env
```

Then fix root cause and revert the cap.

### 2. Port conflict — PM2 can't bind 3001

Symptom: `pm2 logs kolmatrix --err` shows `EADDRINUSE :::3001`.

Why: another process (stale PM2 worker, leftover `next dev`, manual
test) still holds the socket.

```bash
sudo ss -ltnp 'sport = :3001'
# note the PID from the users:(...)  column
sudo kill -9 <pid>
pm2 reload kolmatrix --update-env
```

Check `.env.production` hasn't accidentally been edited to set `PORT`
to something shared with Nginx or another service.

### 3. `npx prisma generate` fails during `npm ci`

Symptom: the `postinstall: prisma generate` hook errors with
`Permission denied` or `DATABASE_URL is not set`.

Why: `prisma generate` imports env via `prisma.config.ts`, which
needs `DATABASE_ADMIN_URL` (or `DATABASE_URL` fallback). If the
deploy user can't read `.env.production`, it can't generate.

```bash
sudo -l                                          # check sudo rights
ls -l /opt/kolmatrix/.env.production            # should be 640 root:deploy
sudo chown root:deploy /opt/kolmatrix/.env.production
sudo chmod 640 /opt/kolmatrix/.env.production
```

If the env file is missing, copy `.env.example`, fill in real
values, never commit.

### 4. `prisma migrate deploy` aborts mid-migration

Symptom: `scripts/deploy-prod.sh` step 5 exits non-zero; Prisma
leaves the `_prisma_migrations` table with a failed row.

Why: migration SQL errored (constraint conflict, missing table, etc.).

**Do not retry migrate deploy blindly.** First:

```bash
set -a; source /opt/kolmatrix/.env.production; set +a
psql "${DATABASE_ADMIN_URL%%\?*}" \
  -c 'SELECT * FROM _prisma_migrations ORDER BY started_at DESC LIMIT 3;'
```

Failed migrations show `finished_at IS NULL` and a `logs` column with
the Postgres error.

Resolution path:

1. If the DDL partially applied: follow the migration's `-- ROLLBACK:`
   block manually in `psql` to undo.
2. Mark the migration rolled back:
   `npx prisma migrate resolve --rolled-back <migration-name>`
3. Fix the migration SQL (in a new migration, not by editing the
   existing one in-place), push, redeploy.

### 5. PM2 itself isn't running after VPS reboot

Symptom: `pm2 status` shows nothing, `curl localhost:3001` refuses.

Why: first-time `pm2 startup` never got finalized, so the systemd
unit doesn't exist or can't resurrect the saved process list.

```bash
sudo systemctl status pm2-deploy   # should be `active (running)`

# If absent, re-run bootstrap:
cd /opt/kolmatrix
pm2 start ecosystem.config.js
pm2 save
pm2 startup                        # prints a sudo env ... command
# run the printed command, then:
pm2 save
```

### 6. `./scripts/healthcheck.sh` exits 1 but `curl` manually works

Symptom: scripted check fails while `curl https://kol.guangai.ai/api/health`
from another terminal returns 200.

Why: most often `jq` isn't on the VPS (`apt install -y jq`), or the
endpoint the script is pointed at differs from what you're curling
by hand (the deploy workflow passes the default — production — URL;
a manual run might be using localhost or a stale domain).

```bash
which jq          # must print /usr/bin/jq
jq --version
HEALTHCHECK_RETRIES=1 HEALTHCHECK_WAIT=0 ./scripts/healthcheck.sh
# if it still fails, run curl with the same flags the script uses:
curl --silent --max-time 10 \
  --write-out "%{http_code}\n" \
  https://kol.guangai.ai/api/health
```

## File / path cheat sheet

| Thing           | Where                                                                                          |
| --------------- | ---------------------------------------------------------------------------------------------- |
| Repo            | `/opt/kolmatrix`                                                                               |
| Env             | `/opt/kolmatrix/.env.production` (root:deploy 0640)                                            |
| Backups         | `/opt/kolmatrix-backups/db-*.sql.gz` + `manifest.log`                                          |
| PM2 logs        | `/var/log/pm2/kolmatrix-{out,error}.log`                                                       |
| PM2 config      | `/opt/kolmatrix/ecosystem.config.js`                                                           |
| Deploy scripts  | `/opt/kolmatrix/scripts/{deploy-prod,backup-db,healthcheck,rollback,validate-rollback-sql}.sh` |
| prev-sha marker | `/tmp/prev-sha` (created at deploy-start, consumed by rollback)                                |
| Nginx site      | `/etc/nginx/sites-enabled/kol.guangai.ai`                                                      |

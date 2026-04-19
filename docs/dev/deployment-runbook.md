# Deployment Runbook

> **Status:** WIP — F002 populates PM2 commands; F008 will fill in the full
> manual fallback + error catalog + rollback walkthroughs.
>
> See `docs/specs/BI2-deployment-automation-spec.md` for the full BI2 scope.

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

## (F008) Further content coming

- Full manual deploy walkthrough (GitHub Actions fallback)
- Health check debug flow
- Manual rollback steps
- `pg_restore` from `/opt/kolmatrix-backups/`
- Common errors: OOM · port conflict · Prisma generate · migration deploy · PM2 crash
- SSH emergency access

# TLS / Staging Runbook

> **Audience:** on-call operator fielding a cert-expiry alert, rotating
> a staging environment, wiring up a new domain, or chasing down an
> Nginx 5xx. Companion to `deployment-runbook.md` (application) and
> `infrastructure.md` (architecture). All canonical configs live in
> `infrastructure/` — anything out of sync with the VPS is a bug.
>
> Batch of origin: BI3-domain-and-tls.

---

## Inventory (as of 2026-04-20)

| Artifact | Path on VPS | Repo source of truth |
|---|---|---|
| Prod vhost | `/etc/nginx/conf.d/kolmatrix.conf` | `infrastructure/nginx/kol.guangai.ai.conf` |
| Staging vhost | `/etc/nginx/sites-available/staging.kolmatrix` (→ `sites-enabled/staging.kolmatrix` symlink) | `infrastructure/nginx/staging.kol.guangai.ai.conf` |
| Brand vhost | `/etc/nginx/sites-available/kolquest.com` (→ `sites-enabled/kolquest.com` symlink) | `infrastructure/nginx/kolquest.com.conf` |
| Cert deploy hook | `/etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh` (0755) | `infrastructure/certbot/renewal-hooks/deploy/reload-nginx.sh` |
| Cert expiry cron | `/etc/cron.d/kolmatrix-cert-expiry` | `infrastructure/cron/kolmatrix-cert-expiry` |
| Expiry-check script | `/opt/kolmatrix/scripts/cert-expiry-check.sh` | `scripts/cert-expiry-check.sh` |

### Certificates in play

| Cert lineage | SANs | Issuer | Renewed via |
|---|---|---|---|
| `kol.guangai.ai` | `kol.guangai.ai` | LE R12 | certbot.timer (webroot, `/var/www/certbot`) |
| `staging.kol.guangai.ai` | `staging.kol.guangai.ai` | LE R13 | certbot.timer |
| `kolquest.com` | `kolquest.com`, `www.kolquest.com` | LE R13 | certbot.timer |
| `aigc.guangai.ai` | `aigc.guangai.ai`, `cdn.aigc.guangai.ai` | LE | owned by aigcgateway project, same renewer |

`certbot.timer` runs twice daily (Ubuntu default schedule ~01:59 UTC + 22:42 UTC). Renewal fires only when a cert is within 30 days of expiry.

---

## 1 — Cert manual renewal

Only do this when a cert is already inside its 30-day renewal window (or you need a force-renewal to test a DNS/Nginx change). Let's Encrypt limits issuance to 5 per domain per week — don't hammer it.

```bash
# Default — respect the 30-day window
ssh kolmatrix-vps
sudo certbot renew

# Force-renew a single lineage (use sparingly; counts against LE quota)
sudo certbot renew --cert-name staging.kol.guangai.ai --force-renewal

# Simulate without hitting LE (use for dry-checking Nginx + ACME path)
sudo certbot renew --dry-run

# Manual issuance of a brand-new cert (skip the full --nginx flow)
sudo certbot certonly --webroot -w /var/www/certbot \
  -d example.com -d www.example.com \
  -n --agree-tos --email tripplezhou@gmail.com
```

After any real renewal, the deploy-hook (`reload-nginx.sh`) should already have reloaded Nginx. Verify:

```bash
sudo journalctl -u nginx --since "5 min ago" | grep -i reload
curl -sSI https://<domain>/ | head -5
```

---

## 2 — Cert expired emergency recovery

Scenario: cert hit 0 days remaining because `certbot.timer` was stopped, DNS flipped, or ACME challenge broke.

```bash
# 1. Confirm expiry with browser or:
echo | openssl s_client -connect <domain>:443 -servername <domain> 2>/dev/null \
  | openssl x509 -noout -enddate

# 2. Check timer state + recent attempts
sudo systemctl status certbot.timer
sudo journalctl -u certbot.service --since "3 days ago" | tail -40

# 3. Verify ACME webroot is still reachable
curl -I http://<domain>/.well-known/acme-challenge/test

# 4. Re-issue immediately (uses webroot, does NOT require Nginx restart
#    to have working upstream — the 80 block serves files directly)
sudo certbot renew --cert-name <domain> --force-renewal
# or for a brand-new host:
sudo certbot certonly --webroot -w /var/www/certbot -d <domain> \
  -n --agree-tos --email tripplezhou@gmail.com

# 5. Reload Nginx (deploy-hook should do this automatically)
sudo nginx -t && sudo systemctl reload nginx

# 6. Sanity
curl -sSI https://<domain>/ | head -5
```

If ACME itself is failing (DNS / firewall / rate-limit), the fix is upstream — do not delete the expired cert in a panic; `ssl_certificate` with a stale file will 525 cleanly until you re-issue, but deleting the file will 500 the Nginx process on reload.

---

## 3 — Adding a new domain

Five steps. Mirror what F002 / F006 did.

1. **DNS** — point `A <subdomain> → 34.180.93.185` at the authoritative provider (Aliyun for `kol.guangai.ai`, Cloudflare for `kolquest.com`). Wait for propagation: `getent hosts <subdomain>`.
2. **Phase 1 vhost** — HTTP-only block with ACME location + 301 stub. Drop at `/etc/nginx/sites-available/<domain>`; `ln -s` into `sites-enabled/`. `nginx -t && systemctl reload nginx`.
3. **Issue cert** — `sudo certbot certonly --webroot -w /var/www/certbot -d <domain> [-d www.<domain>] -n --agree-tos --email tripplezhou@gmail.com`.
4. **Phase 2 vhost** — overwrite file with full 80→301 + 443 ssl block. Include `ssl_dhparam`, HSTS header, and proxy / redirect target. `nginx -t && systemctl reload nginx`.
5. **Repo parity** — export the final file to `infrastructure/nginx/<domain>.conf` and commit. If there's a new cron, also add to `scripts/cert-expiry-check.sh` `DOMAINS=(...)`.

Template: copy `infrastructure/nginx/staging.kol.guangai.ai.conf` (for a reverse-proxy vhost) or `infrastructure/nginx/kolquest.com.conf` (for a pure redirect).

---

## 4 — Nginx config change verification checklist

Every time you touch a vhost (VPS or repo):

- [ ] `sudo nginx -t` returns ok
- [ ] `sudo systemctl reload nginx` exits 0
- [ ] `sudo systemctl is-active nginx` → `active`
- [ ] `sudo journalctl -u nginx --since "1 min ago"` shows reload, no errors
- [ ] `curl -sSI https://<domain>/` returns expected status + headers
- [ ] `curl -sSI http://<domain>/` returns `301 Location: https://...`
- [ ] Security headers present: `strict-transport-security`, and `x-robots-tag: noindex, nofollow` for staging
- [ ] Repo file updated: `infrastructure/nginx/<domain>.conf` matches VPS `diff`
- [ ] CI green (`gh run list --limit 1 --branch main`)

If `nginx -t` fails, fix before reload. A running Nginx with broken config is recoverable (old workers still serve); a reloaded Nginx with broken config is not.

---

## 5 — Staging environment: deploy & restart

Staging runs from `/opt/kolmatrix-staging` with PM2 app name `kolmatrix-staging` on port 3002, independent from prod. Same codebase tracks `main`.

### Deploy new code to staging

```bash
ssh kolmatrix-vps
cd /opt/kolmatrix-staging
git pull --ff-only origin main
npm ci                      # if package-lock changed
npm run build               # rebuild .next/
pm2 restart kolmatrix-staging --update-env
curl -sS https://staging.kol.guangai.ai/api/health | python3 -m json.tool
```

`restart` (not `reload`) is intentional: staging runs a single fork instance, there's nothing to rotate.

### Stop / start

```bash
pm2 stop kolmatrix-staging
pm2 start kolmatrix-staging       # uses saved PM2 config
pm2 save                          # only if process list itself changed
```

### Inspect

```bash
pm2 describe kolmatrix-staging
pm2 logs kolmatrix-staging --lines 200
cat /var/log/pm2/kolmatrix-staging-out.log
```

---

## 6 — Staging DB reset

Wipe the staging database and reseed. **Never run this on prod.**

```bash
ssh kolmatrix-vps
cd /opt/kolmatrix-staging

# 1. Stop the app so connections don't block DROP
pm2 stop kolmatrix-staging

# 2. Drop + recreate (superuser postgres needed for DROP on an owned DB)
sudo -u postgres psql -v ON_ERROR_STOP=1 <<'SQL'
DROP DATABASE IF EXISTS kolmatrix_staging;
CREATE DATABASE kolmatrix_staging OWNER kolmatrix;
GRANT CONNECT ON DATABASE kolmatrix_staging TO kolmatrix_app;
SQL

# 3. Re-apply schema + seed (prisma.config.ts reads DATABASE_ADMIN_URL
#    from .env → .env.staging symlink)
npx prisma migrate deploy
npx prisma db seed

# 4. Restart app
pm2 start kolmatrix-staging

# 5. Smoke test
curl -sS https://staging.kol.guangai.ai/api/health | python3 -m json.tool
PGPASSWORD=$(grep DATABASE_ADMIN_URL .env.staging | sed 's/.*:\([^@]*\)@.*/\1/') \
  psql -h localhost -U kolmatrix -d kolmatrix_staging \
  -c "SELECT (SELECT count(*) FROM kol) AS kols, (SELECT count(*) FROM \"user\") AS users;"
```

Expected seed state: 1 tenant, 2 users (admin + marketer), 12 kols, 3 campaigns, 4 templates, 300 email logs.

---

## 7 — Brand domain (kolquest.com) 301 verification

```bash
# Root 80 → root 443 → main site (two hops by design; HSTS collapses it
# after the first visit)
curl -sSI http://kolquest.com | head -5
# HTTP/1.1 301  Location: https://kolquest.com/

curl -sSI https://kolquest.com | head -5
# HTTP/2   301  Location: https://kol.guangai.ai/

# www variant — same terminal target
curl -sSI https://www.kolquest.com | head -5

# Follow to the end, path + query preserved
curl -sSIL "http://kolquest.com/anything?foo=1" 2>&1 | grep -iE '^(HTTP|location)'
# ... ends at https://kol.guangai.ai/anything?foo=1 or whatever main app returns
```

`send.kolquest.com` does **not** have an Nginx vhost — it serves MX / DKIM / SPF records for Resend bounces only (B4 email path).

---

## 8 — Common failures

### a) Cert expired / browser "NET::ERR_CERT_DATE_INVALID"

- Usually means `certbot.timer` stopped firing. `sudo systemctl status certbot.timer` → re-enable, then see §2.
- Can also be a clock skew on the VPS. `timedatectl` → should be NTP-synced. Rare.

### b) DNS not yet live ("curl: Could not resolve host")

- `getent hosts <domain>` on the VPS and from your local laptop. If VPS resolves but laptop doesn't → local DNS cache; flush.
- If neither resolves → provider-side; verify record in Aliyun / Cloudflare dashboard. TTL 300 in both means max 5-minute propagation.
- ACME webroot challenge fails before TLS is in play — check `/var/log/letsencrypt/letsencrypt.log` for the `urn:ietf:params:acme:error:dns` detail.

### c) `nginx -t` syntax error

- Read the error's file:line pointer literally — nginx reports the exact column. Common culprits:
  - unquoted `$` inside a `add_header` value → use `"..."` around the whole value
  - `include` pointing at a file that doesn't exist (e.g. fresh VPS without `ssl-dhparams.pem`)
  - `upstream` block defined twice from two conf files that both `include /etc/nginx/conf.d/*.conf`
- After fixing, **always rerun** `sudo nginx -t` before reload. If the broken config is already running from a prior `sudo systemctl restart`, you can still reload the good one back in.

### d) 502 Bad Gateway on staging only

- PM2 app down or booting: `pm2 describe kolmatrix-staging` → status should be `online`, not `errored` or `launching`.
- Port mismatch: staging is 3002, not 3001. If `ecosystem.config.js` got merged without our app entry, re-read `infrastructure/nginx/staging.kol.guangai.ai.conf` expecting upstream 3002.
- Boot error: `pm2 logs kolmatrix-staging --err --lines 100`. Most common: missing env var → fix in `/opt/kolmatrix-staging/.env.staging`, then `pm2 restart kolmatrix-staging --update-env`.

### e) Resend alert email not arriving (cert-expiry-check.sh)

- Normal path is silent — alerts only fire when days < 14. Confirm you hit the branch: `sudo FAKE_DAYS=5 /opt/kolmatrix/scripts/cert-expiry-check.sh`; exit 0 means the curl POSTs succeeded.
- If exit is nonzero, the `curl --fail` caught a Resend response ≥ 400. Common cause: sender domain not verified. Known-good sender is `marketer@kolquest.com` (the root, not `send.`).
- Cron not firing: `sudo journalctl -u cron --since "1 hour ago" | grep cert-expiry`. Validate timezone with `CRON_TZ=Asia/Tokyo` at top of `/etc/cron.d/kolmatrix-cert-expiry`.

---

## 9 — Source-of-truth discipline

- **Every VPS change has a repo-side mirror.** If you hand-edit a Nginx file on the VPS, immediately `scp` / `cat` the result back to `infrastructure/nginx/<file>.conf` in a branch and PR it.
- **Never `git pull` `/opt/kolmatrix` directly.** Prod is deployed via `.github/workflows/deploy-prod.yml` — manual pulls bypass the backup + rollback path.
- **Staging tolerates direct pulls** (`/opt/kolmatrix-staging`), but prefer matching prod's workflow so muscle memory stays consistent.

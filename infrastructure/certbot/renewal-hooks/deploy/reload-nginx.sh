#!/usr/bin/env bash
# BI3 F004 — certbot deploy-hook: reload nginx after any cert renewal.
# certbot runs every script in renewal-hooks/deploy/ once, only when one
# or more certificates were actually renewed in this invocation. The
# renewed lineage name is exposed in $RENEWED_LINEAGE (not used here
# because we reload the whole nginx process).
#
# Triggered by: /lib/systemd/system/certbot.service (twice-daily timer
# certbot.timer) → certbot renew → deploy hook on success.
#
# Fails safe: if nginx -t fails we abort reload so a broken config
# cannot silently take the site down; the renewed cert is still on disk
# and the next reload (manual or renewal) can apply it.
set -euo pipefail
/usr/sbin/nginx -t
/bin/systemctl reload nginx

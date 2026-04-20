#!/usr/bin/env bash
# BI3 F005 — daily TLS cert expiry check with Resend email alert.
#
# Runs from /etc/cron.d/kolmatrix-cert-expiry at 08:00 JST (= 23:00 UTC
# previous day). This fires ~9 hours after certbot.timer's 22:42 UTC
# renewal attempt so a failed renewal surfaces before business hours.
#
# For each domain: TLS handshake, read notAfter from the leaf cert,
# compute days_to_expire. If under the threshold (default 14 days), POST
# an email to the Resend API. On success the script is silent (cron
# only logs the execution, no mail spam).
#
# Test hook:
#   FAKE_DAYS=5 /opt/kolmatrix/scripts/cert-expiry-check.sh
# Emits an alert for every configured domain with days=5; used once
# during F005 rollout to confirm the Resend path is live, then
# disabled.
#
# Dependencies: bash, openssl, curl, coreutils (date). Resend key read
# from /opt/kolmatrix/.env.production (same place kolmatrix PM2 app
# reads it; B4 will rotate if staging gets its own sandbox key).

set -euo pipefail

DOMAINS=("kol.guangai.ai" "staging.kol.guangai.ai")
THRESHOLD_DAYS=14
ALERT_TO="tripplezhou@gmail.com"
# Resend has kolquest.com (root) verified; the `send.` subdomain spec'd
# in environment.md earlier was never added as a separate Resend domain
# (MX-only). Using root keeps the address short and works today.
ALERT_FROM="marketer@kolquest.com"
ENV_FILE="/opt/kolmatrix/.env.production"

# Load RESEND_API_KEY from the PM2 env file (root-owned, 640 — this
# script must therefore run as root or a group-tripplezhou member).
if [[ ! -r "$ENV_FILE" ]]; then
    echo "cert-expiry-check: cannot read $ENV_FILE" >&2
    exit 1
fi
# shellcheck disable=SC2002  # `cat` then grep is fine, avoids bash read loop
RESEND_API_KEY=$(grep -E '^RESEND_API_KEY=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"')
if [[ -z "${RESEND_API_KEY:-}" ]]; then
    echo "cert-expiry-check: RESEND_API_KEY missing in $ENV_FILE" >&2
    exit 1
fi

send_alert() {
    local domain="$1" days="$2"
    local subject body
    subject="[KOLMatrix] Cert expiry warning: ${domain} — ${days}d left"
    body="TLS certificate for ${domain} expires in ${days} day(s) (threshold: ${THRESHOLD_DAYS} days).\\n\\nAction: verify certbot.timer + renew is working on $(hostname).\\n\\nCheck logs: journalctl -u certbot.service --since '2 days ago'"
    # POST to Resend; use --fail so non-2xx returns nonzero and set -e
    # breaks the outer loop instead of masking a silent drop.
    curl -sS --fail --max-time 15 \
        -X POST https://api.resend.com/emails \
        -H "Authorization: Bearer ${RESEND_API_KEY}" \
        -H "Content-Type: application/json" \
        -d "{\"from\":\"${ALERT_FROM}\",\"to\":\"${ALERT_TO}\",\"subject\":\"${subject}\",\"text\":\"${body}\"}" \
        >/dev/null
}

days_until_expiry() {
    local domain="$1" not_after expiry_epoch now_epoch
    not_after=$(echo | openssl s_client -connect "${domain}:443" -servername "${domain}" 2>/dev/null \
        | openssl x509 -noout -enddate 2>/dev/null \
        | cut -d= -f2)
    if [[ -z "${not_after}" ]]; then
        echo "cert-expiry-check: TLS probe failed for ${domain}" >&2
        return 1
    fi
    expiry_epoch=$(date -d "${not_after}" +%s)
    now_epoch=$(date +%s)
    echo $(( (expiry_epoch - now_epoch) / 86400 ))
}

for domain in "${DOMAINS[@]}"; do
    if [[ -n "${FAKE_DAYS:-}" ]]; then
        days="${FAKE_DAYS}"
    else
        days=$(days_until_expiry "${domain}") || continue
    fi

    if (( days < THRESHOLD_DAYS )); then
        send_alert "${domain}" "${days}"
    fi
done

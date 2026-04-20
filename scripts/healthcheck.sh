#!/usr/bin/env bash
#
# Poll /api/health and decide whether the deploy is healthy.
#
# Called by scripts/deploy-prod.sh on the VPS right after
# `pm2 reload kolmatrix --update-env`. Exits 0 only when the endpoint
# returns HTTP 200 AND the JSON body's `.status` field equals "healthy".
# Anything else exits 1 after 5 attempts, printing the last response
# body so the deploy log shows exactly why we rolled back.
#
# Usage:
#   scripts/healthcheck.sh                                 # default prod endpoint
#   scripts/healthcheck.sh http://localhost:3000/api/health
#
# Dependencies:  curl + jq  (both preinstalled on the VPS)
# Spec:          docs/specs/BI2-deployment-automation-spec.md §F005

set -u

ENDPOINT=${1:-https://kol.guangai.ai/api/health}
MAX_RETRIES=${HEALTHCHECK_RETRIES:-5}
WAIT_SECONDS=${HEALTHCHECK_WAIT:-3}
RESPONSE_FILE=$(mktemp -t healthcheck-body.XXXXXX)
trap 'rm -f "$RESPONSE_FILE"' EXIT

for ((i = 1; i <= MAX_RETRIES; i++)); do
  sleep "$WAIT_SECONDS"

  # --silent suppresses both the progress meter and any stderr message,
  # so the captured stdout is strictly the %{http_code} digits — no noise
  # to concatenate. curl writes "000" when it can't reach the host at
  # all, so the `|| HTTP_CODE=000` branch is really just a belt for the
  # impossible case where curl exits without emitting anything.
  HTTP_CODE=$(curl --silent --max-time 10 \
    --output "$RESPONSE_FILE" \
    --write-out "%{http_code}" \
    "$ENDPOINT") || HTTP_CODE=000

  if [[ "$HTTP_CODE" == "200" ]]; then
    STATUS=$(jq --raw-output '.status // "missing"' "$RESPONSE_FILE" 2>/dev/null || echo "invalid-json")
    if [[ "$STATUS" == "healthy" ]]; then
      echo "✅ Healthy on attempt ${i}/${MAX_RETRIES} (endpoint: ${ENDPOINT})"
      exit 0
    fi
    echo "⚠️  Attempt ${i}/${MAX_RETRIES}: HTTP 200 but status='${STATUS}'"
  else
    echo "⚠️  Attempt ${i}/${MAX_RETRIES}: HTTP ${HTTP_CODE}"
  fi
done

echo "❌ Health check failed after ${MAX_RETRIES} attempts against ${ENDPOINT}"
echo "--- last response body ---"
cat "$RESPONSE_FILE"
echo
exit 1

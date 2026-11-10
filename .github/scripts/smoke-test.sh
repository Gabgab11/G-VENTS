#!/usr/bin/env bash
# Smoke tests a deployed website:  smoke-test.sh <base url> <path>...
# Every path must answer 200. /api/health is 200 only when the deployment reaches gventz-api.
# When CF_ACCESS_CLIENT_ID/CF_ACCESS_CLIENT_SECRET are set (a Cloudflare Access service token,
# for a staging site behind Access), they are sent as headers; they never appear in the log.
set -uo pipefail
base="${1%/}"; shift
[[ "$base" =~ ^https://[A-Za-z0-9.-]+$ ]] || { echo "::error::Smoke test needs an https origin, got '$base'."; exit 1; }

auth=()
if [ -n "${CF_ACCESS_CLIENT_ID:-}" ] && [ -n "${CF_ACCESS_CLIENT_SECRET:-}" ]; then
  auth=(-H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET")
fi

ok=1
for path in "$@"; do
  code=000
  for attempt in 1 2 3; do # a fresh deployment can take a few seconds to reach every location
    code=$(curl -s -o /dev/null -w '%{http_code}' -m 20 "${auth[@]}" "$base$path") || true
    [ "$code" = "200" ] && break
    sleep $((attempt * 5))
  done
  echo "$path → $code (want 200)"
  [ "$code" = "200" ] || ok=0
done
[ $ok = 1 ] || { echo "::error::Smoke tests failed on $base."; exit 1; }

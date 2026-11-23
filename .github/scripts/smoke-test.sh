#!/usr/bin/env bash
# Smoke tests a deployed website:  smoke-test.sh <base url> <path>...
# Every path must answer 200. /api/health is 200 only when the deployment reaches gventz-api.
# The home page (/) must also render: a 200 can still be the error page, because pages stream and
# a cached copy can hide a failing API (incident 2026-11-20: gventz.com showed "Something went
# wrong" while every check was green). It must contain the home page's own <main class="hp …">
# and must not contain the error page's heading. The same two patterns are the Grafana synthetic
# check gventz-web-home-* (gventz-api ops/grafana/synthetic-checks.json); keep them in step.
# When CF_ACCESS_CLIENT_ID/CF_ACCESS_CLIENT_SECRET are set (a Cloudflare Access service token,
# for a staging site behind Access), they are sent as headers; they never appear in the log.
set -uo pipefail
base="${1%/}"; shift
[[ "$base" =~ ^https://[A-Za-z0-9.-]+$ ]] || { echo "::error::Smoke test needs an https origin, got '$base'."; exit 1; }

auth=()
if [ -n "${CF_ACCESS_CLIENT_ID:-}" ] && [ -n "${CF_ACCESS_CLIENT_SECRET:-}" ]; then
  auth=(-H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET")
fi

HOME_RENDERED='<main class="hp[ "]'
ERROR_PAGE='<h1[^>]*>Something went wrong</h1>'
body=$(mktemp)
trap 'rm -f "$body"' EXIT

ok=1
for path in "$@"; do
  code=000
  rendered=yes
  for attempt in 1 2 3; do # a fresh deployment can take a few seconds to reach every location
    code=$(curl -s -o "$body" -w '%{http_code}' -m 20 "${auth[@]}" "$base$path") || true
    rendered=yes
    if [ "$path" = "/" ] && [ "$code" = "200" ]; then
      if ! grep -Eq "$HOME_RENDERED" "$body" || grep -Eq "$ERROR_PAGE" "$body"; then rendered=no; fi
    fi
    [ "$code" = "200" ] && [ "$rendered" = yes ] && break
    sleep $((attempt * 5))
  done
  if [ "$rendered" = no ]; then
    echo "$path → $code but the error page, not the home page (want the home page to render)"
    ok=0
  else
    echo "$path → $code (want 200)"
    [ "$code" = "200" ] || ok=0
  fi
done
[ $ok = 1 ] || { echo "::error::Smoke tests failed on $base."; exit 1; }

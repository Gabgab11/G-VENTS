#!/usr/bin/env bash
# Downloads gventz-api's openapi.json at a pinned ref (commit SHA or vX.Y.Z tag) to a file.
# gventz-api is a private repo, so this needs read access to it:
#   - CI: the GVENTZ_API_READ_TOKEN secret (fine-grained token, Contents: read on aristokratos/gventz-api)
#   - locally: your `gh` login, if your GitHub account can read the repo
set -euo pipefail

ref="${1:?usage: fetch-api-contract.sh <ref> <output file>}"
out="${2:?usage: fetch-api-contract.sh <ref> <output file>}"
path="repos/aristokratos/gventz-api/contents/openapi.json?ref=$ref"

if [[ -n "${GVENTZ_API_READ_TOKEN:-}" ]]; then
  curl -fsSL --retry 3 \
    -H "Authorization: Bearer $GVENTZ_API_READ_TOKEN" \
    -H "Accept: application/vnd.github.raw+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "https://api.github.com/$path" -o "$out" \
    || { echo "::error::Couldn't download gventz-api@$ref/openapi.json. Check that GVENTZ_API_READ_TOKEN can read aristokratos/gventz-api and hasn't expired." >&2; exit 1; }
elif command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  gh api -H "Accept: application/vnd.github.raw+json" "$path" > "$out"
else
  echo "::error::gventz-api is private. Set GVENTZ_API_READ_TOKEN (CI) or log in with gh (locally)." >&2
  exit 1
fi

#!/usr/bin/env bash
# Release gates shared by the staging promotion and the production deploy (deploy.yml).
# Each gate checks production's readiness for the commit checked out in the working tree:
#
#   release-gates.sh api-contract   PRODUCTION_API_URL
#       The production gventz-api must serve the contract this commit is built against
#       (api-contract.ref), so the website never goes live ahead of its API.
#       Release order is always: migrations, then the API, then the website.
#   release-gates.sh migrations     SUPABASE_ACCESS_TOKEN, SUPABASE_PROD_REF, SUPABASE_PROD_DB_PASSWORD
#       Production must not be missing a migration this commit brings (production migrations
#       stay manual: migrate.yml). Read-only: `db push --dry-run`.
set -euo pipefail

case "${1:-}" in
  api-contract)
    if [ -z "${PRODUCTION_API_URL:-}" ]; then
      echo "::error::Variable PRODUCTION_API_URL is not set, so the production API contract can't be checked."; exit 1
    fi
    ref=$(tr -d '[:space:]' < api-contract.ref)
    [[ "$ref" =~ ^([0-9a-f]{40}|v[0-9]+\.[0-9]+\.[0-9]+)$ ]] || { echo "::error file=api-contract.ref::Must be a full gventz-api commit SHA or a vX.Y.Z tag."; exit 1; }
    node .github/scripts/check-api-contract.mjs \
      "https://raw.githubusercontent.com/aristokratos/gventz-api/$ref/openapi.json" \
      "${PRODUCTION_API_URL%/}/openapi.json"
    ;;
  migrations)
    if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ] || [ -z "${SUPABASE_PROD_REF:-}" ] || [ -z "${SUPABASE_PROD_DB_PASSWORD:-}" ]; then
      echo "::error::Missing Supabase production secrets; can't check production migrations."; exit 1
    fi
    export SUPABASE_DB_PASSWORD="$SUPABASE_PROD_DB_PASSWORD"
    supabase link --project-ref "$SUPABASE_PROD_REF" --password "$SUPABASE_PROD_DB_PASSWORD" >/dev/null
    out=$(supabase db push --linked --dry-run 2>&1) || { echo "$out"; echo "::error::Couldn't check production migrations."; exit 1; }
    echo "$out"
    if grep -qi "would push" <<<"$out"; then
      echo "::error::Production is missing migrations. Run Actions → Database migrations (target production) from staging, then re-run this workflow."; exit 1
    fi
    grep -qi "up to date" <<<"$out" || { echo "::error::Unexpected output from the migration check."; exit 1; }
    echo "Production database is up to date."
    ;;
  *)
    echo "usage: release-gates.sh api-contract|migrations" >&2; exit 2
    ;;
esac

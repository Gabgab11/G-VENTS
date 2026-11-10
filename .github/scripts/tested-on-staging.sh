#!/usr/bin/env bash
# Production deploys only code that ran on staging: passes when some commit with exactly the
# same tree as HEAD had a successful `staging` job in a Deploy run on the staging branch
# (deploy.yml's staging job, which succeeds only after the staging smoke tests pass).
# Comparing trees, not SHAs, works for merge commits, squash merges and fast-forwards alike.
# Needs GH_TOKEN (actions: read) and a checkout with history (fetch-depth: 0).
set -euo pipefail

tree=$(git rev-parse 'HEAD^{tree}')
while read -r run sha; do
  [ -n "$run" ] || continue
  git cat-file -e "$sha^{commit}" 2>/dev/null || git fetch -q --no-tags origin "$sha" 2>/dev/null || continue
  [ "$(git rev-parse "$sha^{tree}")" = "$tree" ] || continue
  result=$(gh api "repos/$GITHUB_REPOSITORY/actions/runs/$run/jobs?per_page=100" \
    --jq '[.jobs[] | select(.name == "staging")][0].conclusion // ""')
  if [ "$result" = "success" ]; then
    echo "Same code as ${sha:0:7}, deployed to staging and smoke-tested (run $run)."
    echo "staging_sha=$sha" >> "${GITHUB_OUTPUT:-/dev/null}"
    exit 0
  fi
done < <(gh api "repos/$GITHUB_REPOSITORY/actions/workflows/deploy.yml/runs?branch=staging&event=push&per_page=50" \
  --jq '.workflow_runs[] | "\(.id) \(.head_sha)"')

echo "::error::$(git rev-parse --short HEAD) is not code that passed staging. Land changes on staging first; main only takes the staging → main pull request."
exit 1

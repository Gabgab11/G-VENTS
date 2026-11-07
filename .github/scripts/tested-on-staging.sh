#!/usr/bin/env bash
# Production deploys only code that ran on staging: passes when some commit with exactly the
# same tree as HEAD has a successful `website-staging` deployment made by this pipeline
# (deploy.yml's staging job, which succeeds only after the staging smoke tests pass).
# Comparing trees, not SHAs, works for merge commits, squash merges and fast-forwards alike.
# Needs GH_TOKEN (deployments: read) and a checkout with history (fetch-depth: 0).
set -euo pipefail

tree=$(git rev-parse 'HEAD^{tree}')
while read -r id sha; do
  [ -n "$id" ] || continue
  git cat-file -e "$sha^{commit}" 2>/dev/null || git fetch -q --no-tags origin "$sha" 2>/dev/null || continue
  [ "$(git rev-parse "$sha^{tree}")" = "$tree" ] || continue
  state=$(gh api "repos/$GITHUB_REPOSITORY/deployments/$id/statuses?per_page=1" --jq '.[0].state // ""')
  if [ "$state" = "success" ]; then
    echo "Same code as ${sha:0:7}, deployed to staging and smoke-tested (deployment $id)."
    echo "staging_sha=$sha" >> "${GITHUB_OUTPUT:-/dev/null}"
    exit 0
  fi
done < <(gh api "repos/$GITHUB_REPOSITORY/deployments?environment=website-staging&per_page=50" \
  --jq '.[] | select(.creator.login == "github-actions[bot]") | "\(.id) \(.sha)"')

echo "::error::$(git rev-parse --short HEAD) is not code that passed staging. Land changes on staging first; main only takes the staging → main pull request."
exit 1

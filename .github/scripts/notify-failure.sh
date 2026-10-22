#!/usr/bin/env bash
# Tells people a release step failed: opens a GitHub issue labelled
# `deploy-failure` (or comments on the one already open), which GitHub emails
# to everyone watching the repo, and posts to Slack when SLACK_WEBHOOK_URL is set.
# Needs GH_TOKEN, SHA and STAGE (staging | production) in the environment.
set -uo pipefail

run_url="$GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID"
short="${SHA:0:7}"
if [ "$STAGE" = "production" ]; then
  title="Production deployment failed"
  what="The production deployment of \`$short\` failed or did not pass its smoke tests. Check $PRODUCTION_URL now; roll back in Vercel → Deployments → Instant Rollback if needed."
else
  title="Staging release blocked"
  what="Commit \`$short\` on \`staging\` was **not** promoted to production. Production is unchanged."
fi
body="$what

- Commit: $GITHUB_SERVER_URL/$GITHUB_REPOSITORY/commit/$SHA
- Run (see the failed step): $run_url"

gh label create deploy-failure --color B60205 --description "Release pipeline failure" 2>/dev/null || true
open=$(gh issue list --label deploy-failure --state open --search "$title in:title" --json number --jq '.[0].number' 2>/dev/null)
if [ -n "$open" ]; then
  gh issue comment "$open" --body "$body"
else
  gh issue create --title "$title" --label deploy-failure --body "$body"
fi

if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
  payload=$(jq -n --arg t ":rotating_light: *$title* ($short)
$what
$run_url" '{text: $t}')
  curl -s -X POST -H 'Content-Type: application/json' --data "$payload" "$SLACK_WEBHOOK_URL" >/dev/null || true
fi

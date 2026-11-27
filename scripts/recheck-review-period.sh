#!/usr/bin/env bash
# Run by .github/workflows/review-period-recheck.yml.
#
# For one pull request ($PR) or every open one: read what the "Review period"
# step said in the latest finished validation run on the pull request's head
# commit, ask scripts/check-review-period.mjs what the rule says now, and run
# the validation again when the two differ.
#
#   step red,   rule met      -> re-run the failed jobs (the step turns green)
#   step green, rule not met  -> re-run the whole run   (the step turns red)
#   anything else             -> nothing
#
# DRY_RUN=1 prints what it would re-run and re-runs nothing.
set -u

repo="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is not set}"

if [ -n "${PR:-}" ]; then
  prs="$PR"
else
  prs=$(gh api "repos/$repo/pulls?state=open&per_page=100" --jq '.[].number') || exit 1
fi

for n in $prs; do
  sha=$(gh api "repos/$repo/pulls/$n" --jq '.head.sha') || { echo "#$n: could not read the pull request"; continue; }
  run=$(gh api "repos/$repo/actions/workflows/validate.yml/runs?head_sha=$sha&event=pull_request&per_page=1" \
    --jq '.workflow_runs[0] | select(. != null) | select(.status == "completed") | .id') || run=""
  if [ -z "$run" ]; then
    echo "#$n: no finished validation run on $sha"
    continue
  fi
  step=$(gh api "repos/$repo/actions/runs/$run/jobs?per_page=100" \
    --jq '[.jobs[].steps[]? | select(.name | startswith("Review period")) | .conclusion][0] // "none"') || step="none"

  node scripts/check-review-period.mjs --pr "$n"
  code=$?
  if [ "$code" -eq 0 ]; then
    rule=success
  elif [ "$code" -eq 1 ]; then
    rule=failure
  else
    echo "#$n: the rule could not be decided; left as it is"
    continue
  fi

  if [ "$step" = "failure" ] && [ "$rule" = "success" ]; then
    action="rerun-failed-jobs"
  elif [ "$step" = "success" ] && [ "$rule" = "failure" ]; then
    action="rerun"
  else
    echo "#$n: step=$step rule=$rule; nothing to do"
    continue
  fi

  if [ "${DRY_RUN:-}" = "1" ]; then
    echo "#$n: step=$step rule=$rule; would call $action on run $run"
  elif gh api -X POST "repos/$repo/actions/runs/$run/$action" >/dev/null; then
    echo "#$n: step=$step rule=$rule; $action on run $run"
  else
    echo "#$n: step=$step rule=$rule; $action on run $run was refused (a run older than 30 days, or a token without write access)"
  fi
done

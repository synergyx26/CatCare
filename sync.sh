#!/usr/bin/env bash
# Auto-sync local master with origin/master. Safe to run unattended:
# only fast-forwards, never touches a dirty tree or a diverged branch.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_DIR"

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') $1"
}

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$BRANCH" != "master" ]; then
  log "On branch '$BRANCH', not master. Skipping."
  exit 0
fi

git fetch origin master --quiet

STATUS="$(git status --porcelain)"
if [ -n "$STATUS" ]; then
  log "Working tree has uncommitted changes. Skipping to avoid clobbering them."
  exit 0
fi

LOCAL="$(git rev-parse master)"
REMOTE="$(git rev-parse origin/master)"
BASE="$(git merge-base master origin/master)"

if [ "$LOCAL" = "$REMOTE" ]; then
  log "Already up to date ($LOCAL)."
elif [ "$LOCAL" = "$BASE" ]; then
  git merge --ff-only origin/master
  log "Fast-forwarded to $(git rev-parse --short master) ($(git log -1 --pretty=%s))."
else
  log "Local master has diverged from origin/master. Skipping — resolve manually."
fi

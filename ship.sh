#!/usr/bin/env bash
set -e

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_DIR"

# Check for any changes including untracked files
STATUS=$(git status --porcelain)
if [ -z "$STATUS" ]; then
  echo "Nothing to commit. Working tree is clean."
  exit 0
fi

echo "Changed files:"
git status --short

echo ""
echo -n "Commit message: "
read MSG </dev/tty

if [ -z "$MSG" ]; then
  echo "Aborted: commit message cannot be empty."
  exit 1
fi

git add -A
git commit -m "$MSG"

echo "Pulling latest..."
git pull --rebase origin master

echo "Pushing..."
git push origin master

echo ""
echo "Done: $(git log --oneline -1)"

#!/usr/bin/env bash
# One-command deploy of this repo's current working-tree state to the
# self-hosted Proxmox instance (192.168.20.20) — the active, daily-use
# deployment (see CLAUDE.md "Deployment Status"). Thin wrapper around the
# real deploy script, which lives in the separate proxmox-homelab repo
# (infra-as-code for the LXC itself, not part of CatCare).
#
# What it does: commits + pushes any pending changes to git (via ./ship.sh,
# so commit history always matches what's live — see proxmox-homelab/
# scripts/deploy-catcare.sh for why that matters), then rsyncs api/ to the
# LXC and builds catcare-api:latest natively there, builds web/ locally
# with the LXC's production env, ships both, and force-recreates the
# api/sidekiq/web containers — a few seconds of downtime while they restart.
#
# Usage:
#   ./deploy-proxmox.sh
#
# Override the proxmox-homelab checkout location if yours differs:
#   PROXMOX_HOMELAB_DIR=/path/to/proxmox-homelab ./deploy-proxmox.sh
set -euo pipefail

RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${CYAN}[deploy]${NC} $1"; }
ok()    { echo -e "${GREEN}[deploy]${NC} $1"; }
warn()  { echo -e "${YELLOW}[deploy]${NC} $1"; }
error() { echo -e "${RED}[deploy] ERROR:${NC} $1"; }

CATCARE_REPO="$(cd "$(dirname "$0")" && pwd)"
PROXMOX_HOMELAB_DIR="${PROXMOX_HOMELAB_DIR:-$HOME/Documents/Proxmox/proxmox-homelab}"
DEPLOY_SCRIPT="$PROXMOX_HOMELAB_DIR/scripts/deploy-catcare.sh"

if [ ! -x "$DEPLOY_SCRIPT" ]; then
  if [ -f "$DEPLOY_SCRIPT" ]; then
    warn "Found $DEPLOY_SCRIPT but it isn't executable — fixing that."
    chmod +x "$DEPLOY_SCRIPT"
  else
    error "Can't find deploy-catcare.sh at: $DEPLOY_SCRIPT"
    error "Set PROXMOX_HOMELAB_DIR if your proxmox-homelab checkout lives elsewhere."
    exit 1
  fi
fi

# ── Commit + push first, so git always reflects what's actually live ─────────
cd "$CATCARE_REPO"
STATUS="$(git status --porcelain)"
if [ -n "$STATUS" ]; then
  info "Uncommitted changes found — committing via ./ship.sh before deploying:"
  echo "$STATUS" | sed 's/^/  /'
  echo ""
  ./ship.sh
else
  ok "Working tree clean."
fi

# ship.sh only pushes when it just committed something — cover the case
# where commits exist locally but were never pushed (e.g. committed by
# hand, or from another machine that didn't push).
git fetch origin master --quiet
LOCAL="$(git rev-parse master)"
REMOTE="$(git rev-parse origin/master)"
if [ "$LOCAL" != "$REMOTE" ]; then
  info "Local master has unpushed commits — pushing to origin..."
  git push origin master
  ok "Pushed $(git log --oneline -1)."
else
  ok "origin/master is up to date."
fi

info "Deploying to the Proxmox self-hosted instance (192.168.20.20)..."
CATCARE_REPO="$CATCARE_REPO" "$DEPLOY_SCRIPT"
ok "Done."

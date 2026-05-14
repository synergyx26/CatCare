#!/bin/bash
set -e

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${CYAN}[api]${NC} $1"; }
ok()    { echo -e "${GREEN}[api]${NC} $1"; }
warn()  { echo -e "${YELLOW}[api]${NC} $1"; }
error() { echo -e "${RED}[api] ERROR:${NC} $1"; }

# ── rbenv ─────────────────────────────────────────────────────────────────────
export PATH="$HOME/.rbenv/bin:$PATH"
if command -v rbenv &>/dev/null; then
  eval "$(rbenv init -)"
  ok "rbenv $(rbenv version-name) active"
else
  error "rbenv not found. Install it: brew install rbenv ruby-build"
  error "Then: rbenv install 4.0.1 && rbenv rehash"
  exit 1
fi

# ── PostgreSQL ────────────────────────────────────────────────────────────────
PG_CONFIG=""
for pg_path in \
  /opt/homebrew/opt/postgresql@17/bin/pg_config \
  /opt/homebrew/opt/postgresql@16/bin/pg_config \
  /opt/homebrew/opt/postgresql@15/bin/pg_config \
  /opt/homebrew/opt/postgresql@14/bin/pg_config \
  /opt/homebrew/bin/pg_config \
  /usr/local/opt/postgresql@17/bin/pg_config \
  /usr/local/opt/postgresql@16/bin/pg_config \
  /usr/local/opt/postgresql@15/bin/pg_config \
  /usr/local/bin/pg_config; do
  if [ -x "$pg_path" ]; then
    PG_CONFIG="$pg_path"
    break
  fi
done

if [ -z "$PG_CONFIG" ]; then
  error "PostgreSQL not found. Install it:"
  echo ""
  echo "  brew install postgresql@17"
  echo "  brew services start postgresql@17"
  echo ""
  echo "Then re-run this script."
  exit 1
fi

PG_BIN="$(dirname "$PG_CONFIG")"
export PATH="$PG_BIN:$PATH"
ok "PostgreSQL found: $PG_CONFIG"

# ── Redis (optional — used by Sidekiq) ───────────────────────────────────────
if ! command -v redis-cli &>/dev/null; then
  warn "Redis not found. Background jobs won't work."
  warn "Install with: brew install redis && brew services start redis"
else
  ok "Redis found: $(redis-cli --version 2>/dev/null || echo 'available')"
fi

# ── .env ──────────────────────────────────────────────────────────────────────
cd "$(dirname "$0")/api"

if [ ! -f ".env" ]; then
  warn ".env not found — database/JWT secrets will use defaults or fail."
  warn "Copy .env.example to .env and fill in your values if you have one."
fi

# ── bundle install ────────────────────────────────────────────────────────────
if ! bundle check &>/dev/null; then
  info "Running bundle install..."
  bundle config set --local build.pg "--with-pg-config=$PG_CONFIG"
  bundle install
  ok "Gems installed."
else
  ok "Gems up to date."
fi

# ── Database ──────────────────────────────────────────────────────────────────
if ! bundle exec rails db:version &>/dev/null; then
  info "Database not found — creating and migrating..."
  bundle exec rails db:create db:migrate
  ok "Database ready."
else
  info "Running pending migrations..."
  bundle exec rails db:migrate 2>/dev/null || true
fi

# ── Start ─────────────────────────────────────────────────────────────────────
ok "Starting Rails API on http://localhost:3000"
exec bundle exec rails server -b 0.0.0.0 -p 3000

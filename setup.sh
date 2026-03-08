#!/bin/bash
set -e

echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║         Wonk HQ Setup               ║"
echo "  ╚══════════════════════════════════════╝"
echo ""

# Check Bun
if ! command -v bun &> /dev/null; then
  echo "[1/5] Installing Bun..."
  curl -fsSL https://bun.sh/install | bash
  export PATH="$HOME/.bun/bin:$PATH"
else
  echo "[1/5] Bun found: $(bun --version)"
fi

# Check Claude Code
if ! command -v claude &> /dev/null; then
  echo ""
  echo "ERROR: Claude Code not found."
  echo "Install from: https://claude.ai/download"
  echo "Then authenticate with your Max subscription."
  exit 1
else
  echo "[2/5] Claude Code found"
fi

# Install dependencies
echo "[3/5] Installing dependencies..."
bun install

# Initialize database
echo "[4/5] Initializing database..."
bun run -e "
const { initDb } = require('./src/lib/db');
const { seedTopics } = require('./src/lib/seed-topics');
const { initSearchIndex } = require('./src/lib/search');
const { getDb } = require('./src/lib/db');
initDb();
seedTopics(getDb());
initSearchIndex(getDb());
console.log('Database initialized and seeded.');
"

# Environment config
echo "[5/5] Configuration..."
if [ ! -f .env ]; then
  cp .env.example .env
  echo ""
  echo "A .env file has been created. You can configure:"
  echo "  - Congress.gov API key (free): https://api.congress.gov/sign-up/"
  echo "  - Email settings for daily digest"
  echo ""
  read -p "Would you like to configure these now? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    read -p "Congress.gov API Key (or press Enter to skip): " api_key
    if [ -n "$api_key" ]; then
      sed -i '' "s/^CONGRESS_API_KEY=.*/CONGRESS_API_KEY=$api_key/" .env 2>/dev/null || \
      sed -i "s/^CONGRESS_API_KEY=.*/CONGRESS_API_KEY=$api_key/" .env
    fi

    read -p "Daily digest email address (or press Enter to skip): " email
    if [ -n "$email" ]; then
      sed -i '' "s/^DIGEST_TO_EMAIL=.*/DIGEST_TO_EMAIL=$email/" .env 2>/dev/null || \
      sed -i "s/^DIGEST_TO_EMAIL=.*/DIGEST_TO_EMAIL=$email/" .env
    fi
  fi
fi

# macOS LaunchD setup
if [[ "$OSTYPE" == "darwin"* ]]; then
  echo ""
  read -p "Set up auto-start on login? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    bun run engine/install-launchd.ts
  fi
fi

echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║         Setup Complete!              ║"
echo "  ╚══════════════════════════════════════╝"
echo ""
echo "  Start Wonk HQ:    bun run dev"
echo "  Start engine:     bun run engine"
echo "  Both at once:     bun run dev & bun run engine"
echo ""

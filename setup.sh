#!/usr/bin/env bash
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

command -v docker >/dev/null 2>&1 || error "Docker is not installed. Install it from https://docs.docker.com/get-docker/"
docker compose version >/dev/null 2>&1 || error "Docker Compose v2 is not available."

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# --- .env ---
if [ ! -f .env ]; then
  info "Creating .env from .env.example..."
  cp .env.example .env

  TOKEN=$(openssl rand -hex 32)
  CONFIG_DIR="$SCRIPT_DIR/.openclaw-data"
  WORKSPACE_DIR="$CONFIG_DIR/workspace"

  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|OPENCLAW_GATEWAY_TOKEN=.*|OPENCLAW_GATEWAY_TOKEN=$TOKEN|" .env
    sed -i '' "s|OPENCLAW_CONFIG_DIR=.*|OPENCLAW_CONFIG_DIR=$CONFIG_DIR|" .env
    sed -i '' "s|OPENCLAW_WORKSPACE_DIR=.*|OPENCLAW_WORKSPACE_DIR=$WORKSPACE_DIR|" .env
  else
    sed -i "s|OPENCLAW_GATEWAY_TOKEN=.*|OPENCLAW_GATEWAY_TOKEN=$TOKEN|" .env
    sed -i "s|OPENCLAW_CONFIG_DIR=.*|OPENCLAW_CONFIG_DIR=$CONFIG_DIR|" .env
    sed -i "s|OPENCLAW_WORKSPACE_DIR=.*|OPENCLAW_WORKSPACE_DIR=$WORKSPACE_DIR|" .env
  fi

  info "Generated gateway token: $TOKEN"
  warn "Edit .env to add your API keys (MINIMAX_API_KEY, BRAVE_API_KEY, etc.)"
else
  info ".env already exists, skipping."
fi

# --- Directories ---
info "Ensuring data directories exist..."
mkdir -p .openclaw-data/workspace
mkdir -p .gog-auth
mkdir -p my_info

# --- openclaw.json ---
if [ ! -f .openclaw-data/openclaw.json ]; then
  info "Creating default openclaw.json..."

  TOKEN_VAL=$(grep OPENCLAW_GATEWAY_TOKEN .env | head -1 | cut -d= -f2-)

  LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || ipconfig getifaddr en0 2>/dev/null || echo "")

  ORIGINS="\"http://localhost:18789\", \"http://127.0.0.1:18789\""
  if [ -n "$LAN_IP" ]; then
    ORIGINS="$ORIGINS, \"http://$LAN_IP:18789\""
  fi

  cat > .openclaw-data/openclaw.json <<EOF
{
  "gateway": {
    "port": 18789,
    "mode": "local",
    "bind": "lan",
    "auth": {
      "token": "$TOKEN_VAL"
    },
    "controlUi": {
      "allowedOrigins": [$ORIGINS]
    }
  }
}
EOF
  info "Created openclaw.json with LAN binding."
else
  info "openclaw.json already exists, skipping."
fi

# --- Build & Start ---
info "Building custom Docker image (this may take a few minutes on first run)..."
docker compose build

info "Starting OpenClaw Gateway..."
docker compose up -d

echo ""
info "=== Setup Complete ==="
echo ""
echo "  Dashboard:  http://localhost:18789/?token=\$(grep OPENCLAW_GATEWAY_TOKEN .env | cut -d= -f2-)"
echo ""
echo "  Next steps:"
echo "    1. Edit .env with your API keys"
echo "    2. Approve device pairing:"
echo "       docker compose exec openclaw-gateway openclaw devices list"
echo "       docker compose exec openclaw-gateway openclaw devices approve <id>"
echo "    3. Connect WhatsApp:"
echo "       docker compose exec -it openclaw-gateway openclaw channels login --channel whatsapp"
echo "    4. (Optional) Set up Gmail — see README.md"
echo ""

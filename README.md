# OpenClaw Docker Deployment

A Docker-based deployment for [OpenClaw](https://github.com/openclaw/openclaw) Gateway — a personal AI agent that connects to WhatsApp, Gmail, and more.

This setup uses a custom Docker image with pre-installed tools for job hunting, networking, and productivity workflows.

## Features

- **MiniMax M2.5** as default model (swap for OpenAI, Anthropic, etc.)
- **WhatsApp** integration via built-in plugin
- **Gmail** access via [gogcli](https://github.com/teddyknox/gogcli) (OAuth 2.0)
- **Brave Search** for web lookups
- **GitHub CLI**, **Go**, **Homebrew** baked into the image
- Persistent config — survives `docker compose down/up` and rebuilds

## Project Structure

```
openclaw/
├── docker-compose.yml        # Service definition
├── Dockerfile                # Custom image (gh, gog, go, brew, ffmpeg…)
├── .env.example              # Environment variable template
├── .gitignore                # Excludes secrets from version control
├── README.md                 # You are here
├── my_info/                  # Mounted into the agent workspace (read/write)
│   ├── resume.example.tex    #   Example resume template
│   └── job_focus.example.md  #   Example job focus document
│
├── .env                      # Your actual secrets (git-ignored)
├── .openclaw-data/           # OpenClaw runtime data (git-ignored)
│   ├── openclaw.json         #   Gateway config (port, auth, bind)
│   ├── agents/               #   Agent config + model definitions
│   └── workspace/            #   Agent workspace
└── .gog-auth/                # Google OAuth tokens (git-ignored)
```

## Quick Start

### 1. Clone and configure

```bash
git clone https://github.com/youruser/openclaw.git
cd openclaw
cp .env.example .env
```

Edit `.env` and fill in:

| Variable | Description |
|----------|-------------|
| `OPENCLAW_GATEWAY_TOKEN` | Auth token — generate with `openssl rand -hex 32` |
| `OPENCLAW_CONFIG_DIR` | Absolute path to `.openclaw-data/` on your machine |
| `OPENCLAW_WORKSPACE_DIR` | Same path + `/workspace` |
| `MINIMAX_API_KEY` | From [MiniMax Platform](https://platform.minimaxi.com) |
| `BRAVE_API_KEY` | *(optional)* From [Brave Search API](https://brave.com/search/api/) |

### 2. Build and start

```bash
docker compose build
docker compose up -d
```

### 3. Open the Dashboard

Visit (replace `<TOKEN>` with your gateway token):

```
http://localhost:18789/?token=<TOKEN>
```

First connection requires device pairing approval:

```bash
docker compose exec openclaw-gateway openclaw devices list
docker compose exec openclaw-gateway openclaw devices approve <request-id>
```

### 4. Connect WhatsApp

```bash
docker compose exec -it openclaw-gateway openclaw channels login --channel whatsapp
```

Scan the QR code in your terminal with the WhatsApp app on your phone.

## Gmail Setup (via gogcli)

The image includes [gogcli](https://github.com/teddyknox/gogcli) for Gmail access. One-time setup:

### Step 1: Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. **APIs & Services → Enabled APIs** → Enable **Gmail API**
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   - Application type: **Desktop app**
   - Download the `client_secret_xxx.json` file
5. **APIs & Services → OAuth consent screen**
   - Set User Type to **External**
   - Add your email as a **Test user**
   - *(Optional)* Click **Publish App** to avoid 7-day token expiry

### Step 2: Import credentials

```bash
docker cp client_secret.json openclaw-gateway:/tmp/client_secret.json
docker compose exec openclaw-gateway gog auth credentials set /tmp/client_secret.json
```

### Step 3: Authorize (remote/headless flow)

```bash
# Generate auth URL
docker compose exec openclaw-gateway gog auth add you@gmail.com --services gmail --remote --step 1
```

Open the printed URL in your browser, authorize, then copy the redirect URL (the page will fail to load — that's expected).

```bash
# Exchange the code
docker compose exec openclaw-gateway gog auth add you@gmail.com --services gmail --remote --step 2 \
  --auth-url 'http://127.0.0.1:XXXXX/oauth2/callback?state=...&code=...'
```

Tokens are persisted in `.gog-auth/` on the host. You won't need to re-authorize after restarts or rebuilds.

## Daily Operations

```bash
# Start
docker compose up -d

# View logs
docker compose logs -f openclaw-gateway

# Restart (after config changes)
docker compose restart openclaw-gateway

# Stop
docker compose down

# Rebuild (after Dockerfile changes)
docker compose down && docker compose build && docker compose up -d
```

## Configuration

### Change default model

```bash
docker compose exec openclaw-gateway openclaw config set agents.defaults.model minimax/MiniMax-M2.5
docker compose restart openclaw-gateway
```

Available MiniMax models:
- `minimax/MiniMax-M2.5` — reasoning, text-only
- `minimax/MiniMax-M2.5-highspeed` — fast reasoning
- `minimax/MiniMax-VL-01` — multimodal (text + image)

To use a different provider, add the API key in `.env` and restart.

### Edit gateway config

```bash
# Direct edit
vim .openclaw-data/openclaw.json
docker compose restart openclaw-gateway

# Or via CLI
docker compose exec openclaw-gateway openclaw config set <key> <value>
```

### Mount custom directories

The `my_info/` folder is already mounted into the agent's workspace. To add more:

```yaml
# In docker-compose.yml → volumes
- /your/path:/home/node/.openclaw/workspace/folder_name:ro
```

> `:ro` = read-only, `:rw` = read-write

## Skills & Plugins

### List available skills

```bash
docker compose exec openclaw-gateway openclaw skills list
```

### Manage plugins

```bash
docker compose exec openclaw-gateway openclaw plugins list
docker compose exec openclaw-gateway openclaw plugins enable <plugin-id>
docker compose exec openclaw-gateway openclaw plugins disable <plugin-id>
docker compose restart openclaw-gateway
```

### Pre-installed tools in this image

| Tool | Purpose |
|------|---------|
| `gh` | GitHub CLI |
| `gog` | Google Workspace CLI (Gmail, Calendar, Drive…) |
| `go` | Go language runtime |
| `brew` | Homebrew package manager |
| `jq` | JSON processor |
| `ffmpeg` | Media processing |
| `git` | Version control |

## Agent Workspace Files

Place these in `.openclaw-data/workspace/` to customize agent behavior:

| File | Purpose |
|------|---------|
| `AGENTS.md` | Agent behavior rules |
| `SOUL.md` | Agent personality |
| `USER.md` | Information about you |
| `IDENTITY.md` | Agent identity |
| `HEARTBEAT.md` | Periodic task checklist |

## Health Check

```bash
docker compose ps
docker compose exec openclaw-gateway openclaw health
docker compose exec openclaw-gateway openclaw channels status
docker compose exec openclaw-gateway openclaw doctor --fix
```

## Security Notes

- `.env`, `.openclaw-data/`, `.gog-auth/`, and `client_secret*.json` are git-ignored
- Gateway binds to LAN (`0.0.0.0`) by default — devices on the same network can access it
- Set `OPENCLAW_GATEWAY_BIND=loopback` in `.env` for localhost-only access
- Token auth is enabled — dashboard requires the gateway token

## Deploying to a VM

For 24/7 uptime (recommended for WhatsApp connectivity):

1. Spin up a VM (AWS Lightsail / GCP e2-micro / DigitalOcean — 1 vCPU, 1GB RAM is enough)
2. Install Docker and Docker Compose
3. `scp` the entire `openclaw/` folder to the VM
4. Update `OPENCLAW_CONFIG_DIR` and `OPENCLAW_WORKSPACE_DIR` in `.env` to match VM paths
5. Update `gateway.controlUi.allowedOrigins` in `.openclaw-data/openclaw.json` with the VM's IP
6. `docker compose build && docker compose up -d`
7. Re-pair WhatsApp (scan QR again)

## License

MIT

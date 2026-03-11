# Separation-of-Powers Agent

> *"The accumulation of all powers, legislative, executive, and judiciary, in the same hands … may justly be pronounced the very definition of tyranny."*
> — James Madison, Federalist No. 47 (1788)

Madison was talking about government. But he could have been talking about AI agents.

## The Problem with Single-Agent Systems

Give one AI agent full power — planning, execution, and self-review — and you get the digital equivalent of an unchecked monarch. It decides what to do, does it, and tells you it went great. No oversight. No audit trail. No separation between "what should we do" and "did we do it right."

In the real world, we solved this problem 250 years ago. Montesquieu proposed it. The American Founders built it. Every functioning democracy runs on it: **separation of powers**.

This project applies the same principle to AI agents.

## The Architecture

```
         ┌─────────┐
         │   You   │
         └────┬────┘
              │
         ┌────▼────┐
         │Secretary │  ← Your chief of staff
         │   📋     │
         └──┬─┬─┬──┘
            │ │ │
   ┌────────┘ │ └────────┐
   ▼          ▼          ▼
┌──────┐  ┌──────┐  ┌──────┐
│Legis.│  │Exec. │  │Judic.│
│  🏛️  │  │  ⚙️  │  │  ⚖️  │
└──────┘  └──────┘  └──────┘
 Policy     Plan     Review
```

| Agent | Role | Real-World Analog |
|-------|------|-------------------|
| 📋 **Secretary** | Orchestrator | Chief of Staff — translates your intent, coordinates branches |
| 🏛️ **Legislature** | Policy Maker | Congress — defines rules, budgets, constraints, acceptance criteria |
| ⚙️ **Executive** | Planner & Doer | President / agencies — proposes plans, executes after approval |
| ⚖️ **Judiciary** | Reviewer | Supreme Court — reviews for compliance, risk, and evidence |

### Why This Works

The same reason it works in government:

- **No single agent can act unilaterally.** The Legislature sets rules but can't execute. The Executive executes but needs approval. The Judiciary reviews but can't act.
- **Every action has an audit trail.** Policy → Plan → Verdict → Execution → Final Review. Every phase produces structured, inspectable output.
- **Mistakes get caught before they happen.** The Judiciary reviews plans *before* execution, not after. A MODIFY verdict sends the Executive back to the drawing board.
- **Power is bounded.** Each agent has explicit constraints on what it can and cannot do, enforced by the others.

### The Historical Parallel

| Concept | Government | This System |
|---------|-----------|-------------|
| Checks & balances | Legislature writes law, Executive enforces, Judiciary interprets | Legislature writes policy, Executive plans/executes, Judiciary approves/denies |
| Veto power | President vetoes bills, Court strikes down laws | Judiciary returns MODIFY/DENY, Executive must revise |
| Separation of concerns | Congress doesn't command armies, courts don't write laws | Legislature doesn't execute, Executive doesn't self-review |
| Transparency | Public record, FOIA | Structured output at every phase, full execution logs |
| Due process | No punishment without trial | No execution without Judiciary approval |

### The 6-Phase Protocol

```
Phase A  →  Legislature drafts POLICY
Phase B  →  Executive drafts PLAN (within policy)
Phase C  →  Judiciary reviews: APPROVE / DENY / MODIFY
Phase D  →  Executive revises (if MODIFY) — loop until APPROVED
Phase E  →  Executive executes, producing evidence per step
Phase F  →  Judiciary conducts FINAL REVIEW
```

The Secretary orchestrates this entire flow automatically using OpenClaw's `sessions_spawn` sub-agent system. You give it a task; it runs the full protocol and reports back.

## What's in the Box

Beyond the multi-agent system, this is a fully configured [OpenClaw](https://github.com/openclaw/openclaw) Gateway deployment:

- **Docker-based** — one `docker compose up` and you're running
- **MiniMax M2.5** as default model (swap for OpenAI, Anthropic, etc.)
- **WhatsApp** integration
- **Gmail** access via OAuth
- **Brave Search**, **GitHub CLI**, **Go**, **LaTeX**, **Homebrew** baked in
- **Persistent config** — survives restarts and rebuilds

## Quick Start

### 1. Clone and configure

```bash
git clone https://github.com/SonghanHu/ClawJobHunt.git
cd ClawJobHunt
cp .env.example .env
```

Edit `.env`:

| Variable | Description |
|----------|-------------|
| `OPENCLAW_GATEWAY_TOKEN` | Generate with `openssl rand -hex 32` |
| `OPENCLAW_CONFIG_DIR` | Absolute path to `.openclaw-data/` |
| `OPENCLAW_WORKSPACE_DIR` | Same path + `/workspace` |
| `MINIMAX_API_KEY` | From [MiniMax Platform](https://platform.minimaxi.com) |
| `BRAVE_API_KEY` | *(optional)* [Brave Search API](https://brave.com/search/api/) |

### 2. Build and start

```bash
./setup.sh
```

Or manually:

```bash
docker compose build
docker compose up -d
```

### 3. Set up the multi-agent system

```bash
./setup-agents.sh
```

This creates all 4 agents, deploys their personalities from `templates/`, configures sub-agent permissions, and restarts the gateway.

### 4. Open the Dashboard

```
http://localhost:18789/?token=<YOUR_TOKEN>
```

First connection requires device pairing:

```bash
docker compose exec openclaw-gateway openclaw devices list
docker compose exec openclaw-gateway openclaw devices approve <request-id>
```

### 5. Talk to the Secretary

Navigate to:

```
http://localhost:18789/chat?session=agent%3Asecretary%3Amain
```

Give it a task. Watch the branches deliberate.

### 6. Connect WhatsApp (optional)

```bash
docker compose exec -it openclaw-gateway openclaw channels login --channel whatsapp
```

## Gmail Setup

The image includes [gogcli](https://github.com/teddyknox/gogcli) for Gmail access:

1. Create a Google Cloud project → enable Gmail API → create OAuth Desktop credentials
2. Add yourself as a test user (or publish the app)
3. Import credentials and authorize:

```bash
docker cp client_secret.json openclaw-gateway:/tmp/client_secret.json
docker compose exec openclaw-gateway gog auth credentials set /tmp/client_secret.json
docker compose exec openclaw-gateway gog auth add you@gmail.com --services gmail --remote --step 1
# Open the URL, authorize, copy redirect URL
docker compose exec openclaw-gateway gog auth add you@gmail.com --services gmail --remote --step 2 \
  --auth-url 'http://127.0.0.1:XXXXX/oauth2/callback?...'
```

Tokens persist in `.gog-auth/` across restarts.

## Project Structure

```
├── docker-compose.yml          # Container orchestration
├── Dockerfile                  # Custom image (gh, gog, go, brew, latex, ffmpeg)
├── setup.sh                    # One-command basic deployment
├── setup-agents.sh             # One-command multi-agent setup
├── ARCHITECTURE.md             # Detailed architecture design
├── templates/agents/           # SOUL.md, IDENTITY.md templates for each agent
├── my_info/                    # Your files, mounted into the agent workspace
├── .env.example                # Environment variable template
└── .gitignore                  # Keeps your secrets out of git
```

## Pre-installed Tools

| Tool | Purpose |
|------|---------|
| `gh` | GitHub CLI |
| `gog` | Google Workspace CLI (Gmail, Calendar, Drive) |
| `go` | Go runtime |
| `brew` | Homebrew |
| `pdflatex` | LaTeX → PDF compilation |
| `jq` | JSON processing |
| `ffmpeg` | Media processing |
| `git` | Version control |

## Customization

### Change the default model

```bash
docker compose exec openclaw-gateway openclaw config set agents.defaults.model minimax/MiniMax-M2.5
docker compose restart openclaw-gateway
```

### Edit agent personalities

Modify `templates/agents/*_SOUL.md` and rerun `./setup-agents.sh`, or edit directly in `.openclaw-data/workspace-{agent}/SOUL.md`.

### Mount your own directories

```yaml
# docker-compose.yml → volumes
- /your/path:/home/node/.openclaw/workspace/folder_name:ro
```

### Deploy to a VM

For 24/7 uptime (recommended — your laptop sleeping kills WhatsApp):

1. Spin up a VM (1 vCPU, 1GB RAM is enough)
2. Install Docker
3. `scp` the folder, update paths in `.env`
4. `docker compose build && docker compose up -d`
5. Re-pair WhatsApp

## Security

- `.env`, `.openclaw-data/`, `.gog-auth/`, `client_secret*.json` are git-ignored
- Token auth is required for dashboard access
- Gateway binds to LAN by default — set `OPENCLAW_GATEWAY_BIND=loopback` for localhost-only
- Access control: only the owner can modify agent settings (enforced in `USER.md`)

## Why "Separation of Powers" for AI?

We're entering an era where AI agents take real actions — sending emails, writing code, managing finances, making decisions. The stakes are no longer theoretical.

A single unchecked agent is a single point of failure. It hallucinates? Nobody catches it. It misunderstands the task? It plows ahead anyway. It takes an irreversible action? Too late.

The Founders didn't trust any single branch of government with unchecked power — not because the people in those branches were bad, but because **concentrated power is inherently risky, regardless of intent.**

The same logic applies to AI. Not because the models are malicious, but because:

- **Models hallucinate.** A reviewer catches what the doer misses.
- **Context gets lost.** Structured handoffs between agents preserve intent better than one long conversation.
- **Irreversible actions need gates.** An approval step before execution is cheap insurance.
- **Audit trails matter.** When something goes wrong, you want to know exactly where and why.

This isn't about distrusting AI. It's about building systems that are **robust by design** — the same way we build redundancy into bridges, backups into databases, and checks into democracies.

*"Trust, but verify."* — Ronald Reagan (and also good systems engineering)

## License

MIT

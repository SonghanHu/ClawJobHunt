# Separation-of-Powers Agent (OpenClaw)

> *"The accumulation of all powers, legislative, executive, and judiciary, in the same hands … may justly be pronounced the very definition of tyranny."*
> — James Madison, Federalist No. 47 (1788)

Multi-agent system on [OpenClaw](https://github.com/openclaw/openclaw): **main** (🦞 龙虾) for general chat and channels, **secretary** (📋) orchestrating Legislature → Executive → Judiciary with flowId-tracked task flows. Includes a **task-progress** dashboard to observe sessions, tool calls, and flows.

---

## Architecture

| Agent | Role |
|-------|------|
| 🦞 **main** | Default assistant — webchat, Discord, WhatsApp, cron; each session has its own flowId for the dashboard |
| 📋 **secretary** | Orchestrator — turns your request into a task packet, spawns branches, enforces the 6-phase protocol |
| 🏛️ **legislature** | Policy — defines rules, constraints, acceptance criteria |
| ⚙️ **executive** | Plan & execute — proposes plans, runs after Judiciary approval |
| ⚖️ **judiciary** | Review — APPROVE / MODIFY / DENY; final review of execution |

Secretary uses `sessions_spawn` with labels like `[flow:yyyyMMdd-HHmmss-xxxx] Legislature: Policy Draft - TASK_TITLE`. Same flowId is reused for the whole chain so the dashboard can group phases into one task flow.

---

## What’s in the box

- **OpenClaw Gateway** — Docker, MiniMax M2.5 (or swap model), WhatsApp / Discord / Gmail, Brave Search, gh, gog, Go, LaTeX, etc.
- **Task Progress Dashboard** — Read-only UI at **http://localhost:3080**: flowchart view of sessions and tool calls, split into **三权分立系统** (Secretary/Legislature/Executive/Judiciary) and **龙虾主系统** (main agent). FlowId-based grouping; main sessions get a synthetic flowId so they appear as proper flows.
- **Session model** — New conversation = new session; shared long-term context lives in `USER.md` (and planned `MEMORY.md`), not in transcript.

---

## Quick start

### 1. Clone and configure

```bash
git clone <your-repo>
cd openclaw
cp .env.example .env
```

Edit `.env`:

| Variable | Description |
|----------|-------------|
| `OPENCLAW_GATEWAY_TOKEN` | `openssl rand -hex 32` |
| `OPENCLAW_CONFIG_DIR` | Absolute path to `.openclaw-data/` |
| `OPENCLAW_WORKSPACE_DIR` | Same path + `/workspace` |
| `MINIMAX_API_KEY` | [MiniMax Platform](https://platform.minimaxi.com) |
| `BRAVE_API_KEY` | *(optional)* [Brave Search API](https://brave.com/search/api/) |

### 2. Build and start

```bash
./setup.sh
docker compose up -d
```

### 3. Multi-agent setup

```bash
./setup-agents.sh
```

Creates secretary, legislature, executive, judiciary; deploys SOUL/IDENTITY/USER from `templates/agents/`; configures sub-agent permissions; restarts the gateway.

### 4. Open control console and task progress

- **Control console (chat):**  
  `http://localhost:18789/?token=<YOUR_TOKEN>`

  First time: pair device:
  ```bash
  docker compose exec openclaw-gateway openclaw devices list
  docker compose exec openclaw-gateway openclaw devices approve <request-id>
  ```

- **Task progress (read-only dashboard):**  
  `http://localhost:3080`  
  No token; mounts `.openclaw-data` read-only. Shows sessions, pipeline phases, and tool calls (e.g. `web_search`) per flow.

### 5. Talk to Secretary (or main)

- Secretary:  
  `http://localhost:18789/chat?session=agent%3Asecretary%3Amain`
- Main:  
  `http://localhost:18789/chat?session=agent%3Amain%3Amain`

### 6. New session / switch session

- **New main session:** In the control UI, use the **New session** button or type **`/new`** or **`/reset`** in the chat input.
- **Switch session:** Change the URL `session=` parameter to the desired session key (e.g. `agent%3Amain%3Adiscord%3Achannel%3A123`), or use the session list in the UI if available.

---

## Task Progress (任务进度)

- **URL:** http://localhost:3080 (or `TASK_PROGRESS_PORT`)
- **Start:** `docker compose up -d task-progress`  
  After code changes: `docker compose up -d --force-recreate task-progress` so the container repacks the app.

**Tabs:**

- **Dashboard** — Flows grouped by system (三权分立 / 龙虾主系统). Each flow shows phases/sessions and tool call timeline. Filters: agent, scope (active/all/history), system, “显示未归档 session”.
- **流程时间线** — Raw pipeline phases from Secretary `sessions_spawn` labels.
- **全局工具流** — All tool calls across agents, reverse chronological.

**APIs:** `GET /api/sessions`, `GET /api/pipeline`, `GET /api/tools`, `GET /api/health`. See `task-progress/README.md` and `docs/TASK-PROGRESS-FRONTEND.md`.

---

## Project structure

```
├── docker-compose.yml       # openclaw-gateway + task-progress
├── Dockerfile               # Custom image (gh, gog, go, brew, latex, ffmpeg)
├── setup.sh                 # Basic deployment
├── setup-agents.sh          # Multi-agent setup (agents, SOUL, permissions)
├── task-progress/           # Task progress backend + frontend (Node, port 3080)
│   ├── server.js            # /api/sessions, /api/pipeline, /api/tools
│   └── public/index.html    # Dashboard UI
├── docs/
│   └── TASK-PROGRESS-FRONTEND.md
├── templates/agents/       # SOUL.md, IDENTITY.md, USER.md per agent
├── my_info/                 # Mounted into agent workspace
├── ARCHITECTURE.md          # Protocol, workspace layout, session key format
├── .env.example
└── .gitignore               # .openclaw-data, .env, .gog-auth, etc.
```

---

## Customization

- **Default model:**  
  `docker compose exec openclaw-gateway openclaw config set agents.defaults.model minimax/MiniMax-M2.5` then restart.
- **Agent personalities:** Edit `templates/agents/*_SOUL.md` and run `./setup-agents.sh`, or edit `.openclaw-data/workspace-{agent}/SOUL.md` directly.
- **FlowId protocol:** Secretary SOUL defines the `[flow:...]` label format and that the same flowId is used for the whole chain; task-progress parses it for grouping.

---

## Security

- `.env`, `.openclaw-data/`, `.gog-auth/`, and secrets are git-ignored.
- Dashboard access is token-protected; task-progress is read-only and uses mounted config only.
- Access control (only owner may change settings) is enforced in `USER.md` across workspaces.

---

## License

MIT

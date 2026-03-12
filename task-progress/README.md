# Task Progress UI

Small read-only dashboard to observe OpenClaw **sessions** and **pipeline phases** (Secretary spawns: Legislature → Executive → Judiciary).

- **Sessions:** Lists all sessions across agents (from `agents/*/sessions/sessions.json`), sorted by last updated.
- **Pipeline:** Parses Secretary session transcript(s) for `sessions_spawn` tool calls and shows phase labels (e.g. "Legislature: Policy Draft", "Executive: Plan Draft") with timestamps.

## Run with Docker

From the repo root:

```bash
docker compose up -d task-progress
```

Then open: **http://localhost:3080** (or `TASK_PROGRESS_PORT` if set).

The service mounts `.openclaw-data` read-only; no gateway token required.

## Run locally (no Docker)

```bash
cd task-progress
npm install
OPENCLAW_CONFIG_DIR=/path/to/your/.openclaw-data npm start
```

Open http://localhost:3080.

## API

- `GET /api/sessions` — `{ agents, sessions[] }` with `agentId`, `sessionKey`, `updatedAt`, `origin`, etc.
- `GET /api/pipeline` — `{ phases[], sessionKeys[] }` from Secretary spawn labels.

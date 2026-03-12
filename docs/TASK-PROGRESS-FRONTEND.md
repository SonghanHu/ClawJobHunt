# Task Progress Frontend — Design

Goal: a small frontend to **observe task progress** (sessions, runs, separation-of-powers phases).

## Data sources

| Source | What it gives | Real-time? |
|--------|----------------|------------|
| **Gateway WebSocket** | `sessions.list`, `chat.history`, run/chat events | Yes (when connected) |
| **.openclaw-data on disk** | `agents/*/sessions/sessions.json`, session JSONL transcripts | Poll or file watch |

OpenClaw’s Control UI already uses the gateway WS for chat, sessions list, and exec approvals. A **per-session activity API** (`sessions.activity.get` / `list`) is proposed in [issue #39127](https://github.com/openclaw/openclaw/issues/39127) but may not be in your version yet.

## Options

### Option A — Extend OpenClaw Control UI (upstream)

- **Pros:** Single app, same auth, already has sessions + chat.
- **Cons:** Need to build OpenClaw’s UI (Vite + Lit), add a “Task progress” or “Pipeline” view and possibly contribute back.
- **Fit:** If you want everything inside the official dashboard.

### Option B — Standalone app talking to Gateway WebSocket

- **Pros:** Full control over UI; can reuse same token and protocol.
- **Cons:** Must implement gateway protocol (connect handshake, `sessions.list`, optional events). Token must be used from a backend or secure env.
- **Fit:** Custom UX, one dedicated “task progress” app.

### Option C — Backend reading .openclaw-data + simple frontend (recommended MVP)

- **Pros:** No gateway protocol; reuse your existing mount of `.openclaw-data`. Can parse `sessions.json` and, if needed, session JSONL for `sessions_spawn` (phase labels).
- **Cons:** Not real-time unless you poll or watch files; depends on on-disk format.
- **Fit:** Fast to ship, run alongside Docker with same volume mount.

## Recommended MVP (Option C)

1. **Backend** (e.g. Node/Express or Fastify):
   - Read-only access to `OPENCLAW_CONFIG_DIR` (e.g. `.openclaw-data`).
   - **GET /api/sessions** — aggregate `agents/*/sessions/sessions.json` → list of `{ agentId, sessionKey, updatedAt, origin, sessionId }`.
   - Optional: **GET /api/pipeline** — from secretary’s session transcript(s), parse last N `sessions_spawn` tool_calls (e.g. by label: "Legislature: Policy Draft", "Executive: Plan Draft") and return phases with timestamps.
   - Serve static frontend or CORS for a separate frontend.

2. **Frontend** (e.g. Vite + React or Svelte):
   - **Sessions view:** table or cards of sessions (agent, session key, last updated, origin label).
   - **Pipeline view (optional):** for secretary flows, show Phase A → B → C → D → E → F with status (done / running / pending) and timestamps.
   - Optional: “Open in Dashboard” link to `http://localhost:18789/?token=...` for the relevant session.

3. **Deploy:**
   - Run backend in Docker (same compose project) with the same `.openclaw-data` mount (read-only).
   - Frontend: same container serving static files, or separate `frontend/` app in dev (proxy to backend).

## Auth

- Backend API can be **local-only** (bind to 127.0.0.1) or protected by a simple API key / cookie so only you can open the task progress UI.
- Do **not** put the gateway token in the frontend; use it only in the existing Control UI or in a backend that proxies to the gateway if you add Option B later.

## Next step

Implement the MVP: add a small backend (e.g. `task-progress-api/`) and a minimal frontend (e.g. `task-progress-ui/`) under the repo, plus a Docker service that mounts `.openclaw-data` and serves the API + UI.

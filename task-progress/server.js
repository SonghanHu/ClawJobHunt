import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const DATA_DIR = process.env.OPENCLAW_CONFIG_DIR || path.join(__dirname, '..', '.openclaw-data');

function readSessionsForAgent(agentId) {
  const sessionsPath = path.join(DATA_DIR, 'agents', agentId, 'sessions', 'sessions.json');
  if (!fs.existsSync(sessionsPath)) return [];
  const raw = fs.readFileSync(sessionsPath, 'utf8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  const entries = [];
  for (const [sessionKey, meta] of Object.entries(data)) {
    if (!meta || typeof meta !== 'object') continue;
    entries.push({
      agentId,
      sessionKey,
      sessionId: meta.sessionId,
      updatedAt: meta.updatedAt,
      chatType: meta.chatType,
      origin: meta.origin || {},
      abortedLastRun: meta.abortedLastRun,
    });
  }
  return entries;
}

app.get('/api/sessions', (req, res) => {
  const agentsDir = path.join(DATA_DIR, 'agents');
  if (!fs.existsSync(agentsDir)) {
    return res.json({ agents: [], sessions: [] });
  }
  const agentIds = fs.readdirSync(agentsDir).filter((name) => {
    const p = path.join(agentsDir, name);
    return fs.statSync(p).isDirectory();
  });
  const sessions = [];
  for (const agentId of agentIds) {
    const list = readSessionsForAgent(agentId);
    for (const s of list) sessions.push(s);
  }
  sessions.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  res.json({ agents: agentIds, sessions });
});

function parseSpawnLabelsFromTranscript(sessionFilePath) {
  if (!sessionFilePath || !fs.existsSync(sessionFilePath)) return [];
  const content = fs.readFileSync(sessionFilePath, 'utf8');
  const lines = content.split('\n').filter(Boolean);
  const phases = [];
  for (const line of lines) {
    try {
      const msg = JSON.parse(line);
      const ts = msg.timestamp || msg.message?.timestamp || msg.ts || Date.now();
      const tsMs = typeof ts === 'number' ? ts : new Date(ts).getTime();
      // OpenClaw JSONL: message.content[] with type:"toolCall", name:"sessions_spawn", arguments:{}
      const contentArr = msg.message?.content || msg.content;
      if (!Array.isArray(contentArr)) continue;
      for (const block of contentArr) {
        if (block.type !== 'toolCall' && block.type !== 'tool_call') continue;
        const name = block.name || block.toolName;
        if (name !== 'sessions_spawn') continue;
        const args = block.arguments || block.args || {};
        const agentId = args.agentId || '?';
        const label = args.label || (args.task ? args.task.slice(0, 60) + '…' : 'spawn');
        phases.push({ label, agentId, at: tsMs });
      }
    } catch {
      // skip malformed lines
    }
  }
  return phases.slice(-80);
}

app.get('/api/pipeline', (req, res) => {
  const secretarySessions = path.join(DATA_DIR, 'agents', 'secretary', 'sessions', 'sessions.json');
  if (!fs.existsSync(secretarySessions)) {
    return res.json({ phases: [], sessionKeys: [] });
  }
  const raw = fs.readFileSync(secretarySessions, 'utf8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return res.json({ phases: [], sessionKeys: [] });
  }
  const sessionKeys = Object.keys(data);
  const allPhases = [];
  for (const [, meta] of Object.entries(data)) {
    const sessionFile = normalizeSessionPath(meta.sessionFile, DATA_DIR);
    if (sessionFile) {
      const phases = parseSpawnLabelsFromTranscript(sessionFile);
      allPhases.push(...phases.map((p) => ({ ...p, sessionId: meta.sessionId })));
    }
  }
  allPhases.sort((a, b) => (a.at || 0) - (b.at || 0));
  res.json({ phases: allPhases.slice(-100), sessionKeys });
});

function normalizeSessionPath(p, dataDir) {
  if (!p) return null;
  // Container writes /home/node/.openclaw/agents/...; host or other container uses dataDir
  const prefix = '/home/node/.openclaw/';
  if (p.startsWith(prefix)) return path.join(dataDir, p.slice(prefix.length));
  if (p.includes('agents') && p.endsWith('.jsonl')) {
    const parts = p.replace(/\\/g, '/').split('/');
    const i = parts.indexOf('agents');
    if (i >= 0 && parts[i + 1] && parts[i + 2] === 'sessions') return path.join(dataDir, ...parts.slice(i));
  }
  return p;
}

function summarizeArgs(toolName, args) {
  if (!args || typeof args !== 'object') return '';
  if (toolName === 'exec' || toolName === 'run') {
    const cmd = args.rawCommand || args.command || args.argv?.[0] || '';
    return String(cmd).slice(0, 120);
  }
  if (toolName === 'edit' || toolName === 'apply_patch') {
    return args.path || args.filePath || args.target || '';
  }
  if (toolName === 'sessions_spawn') {
    const id = args.agentId || '';
    const label = args.label || (args.task ? String(args.task).slice(0, 50) + '…' : '');
    return label ? `${id}: ${label}` : id;
  }
  if (toolName === 'read_file' || toolName === 'read') {
    return args.path || args.filePath || '';
  }
  return JSON.stringify(args).slice(0, 80);
}

function summarizeResult(content) {
  if (!content) return '';
  const arr = Array.isArray(content) ? content : [content];
  const first = arr.find((c) => c.type === 'text' && c.text);
  const text = first?.text || '';
  if (text.length <= 100) return text.trim();
  return text.slice(0, 100).trim() + '…';
}

function parseToolEventsFromTranscript(sessionFilePath, agentId, sessionId) {
  if (!sessionFilePath || !fs.existsSync(sessionFilePath)) return [];
  const content = fs.readFileSync(sessionFilePath, 'utf8');
  const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const events = [];
  for (const line of lines) {
    try {
      const msg = JSON.parse(line);
      if (msg.type === 'session') continue;
      const ts = msg.timestamp || msg.message?.timestamp || msg.ts;
      const tsMs = ts ? (typeof ts === 'number' ? ts : new Date(ts).getTime()) : null;
      const model = msg.message?.model || msg.model || msg.provider;
      const m = msg.message || msg;

      // Message-level toolResult (OpenClaw: role "toolResult", toolName + content on message)
      if (m.role === 'toolResult' && m.toolName) {
        events.push({
          at: tsMs,
          agentId,
          sessionId,
          type: 'toolResult',
          toolName: m.toolName,
          output: summarizeResult(m.content),
          model: model || null,
        });
        continue;
      }

      const contentArr = m.content || msg.content;
      if (!Array.isArray(contentArr)) continue;
      for (const block of contentArr) {
        if (block.type === 'toolCall' || block.type === 'tool_call') {
          const name = block.name || block.toolName;
          const args = block.arguments || block.args || {};
          events.push({
            at: tsMs,
            agentId,
            sessionId,
            type: 'toolCall',
            toolName: name,
            input: summarizeArgs(name, args),
            model: model || null,
          });
        }
      }
    } catch {
      // skip
    }
  }
  return events;
}

app.get('/api/tools', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '150', 10), 500);
  const debug = req.query.debug === '1' || req.query.debug === 'true';
  const agentsDir = path.join(DATA_DIR, 'agents');
  const out = { events: [] };
  if (debug) out.debug = { dataDir: DATA_DIR, agentsDirExists: fs.existsSync(agentsDir), agents: [], filesRead: 0, eventsPerAgent: {} };

  if (!fs.existsSync(agentsDir)) {
    return res.json(out);
  }
  const agentIds = fs.readdirSync(agentsDir).filter((name) => {
    const p = path.join(agentsDir, name);
    return fs.statSync(p).isDirectory();
  });
  if (debug) out.debug.agents = agentIds;

  const allEvents = [];
  for (const agentId of agentIds) {
    const sessionsPath = path.join(DATA_DIR, 'agents', agentId, 'sessions', 'sessions.json');
    if (!fs.existsSync(sessionsPath)) continue;
    let data;
    try {
      data = JSON.parse(fs.readFileSync(sessionsPath, 'utf8'));
    } catch {
      continue;
    }
    let agentEvents = 0;
    for (const [, meta] of Object.entries(data)) {
      if (!meta || typeof meta !== 'object') continue;
      const sessionFile = normalizeSessionPath(meta.sessionFile, DATA_DIR);
      if (debug && sessionFile) out.debug.filesRead += 1;
      const events = parseToolEventsFromTranscript(sessionFile, agentId, meta.sessionId);
      allEvents.push(...events);
      agentEvents += events.length;
    }
    if (debug) out.debug.eventsPerAgent[agentId] = agentEvents;
  }
  allEvents.sort((a, b) => (a.at || 0) - (b.at || 0));
  out.events = allEvents.slice(-limit);
  res.json(out);
});

app.get('/api/health', (req, res) => {
  const agentsDir = path.join(DATA_DIR, 'agents');
  res.json({
    ok: true,
    dataDir: DATA_DIR,
    dataDirExists: fs.existsSync(DATA_DIR),
    agentsDirExists: fs.existsSync(agentsDir),
  });
});

const PORT = parseInt(process.env.PORT || '3080', 10);
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Task progress API + UI: http://0.0.0.0:${PORT} (OPENCLAW_CONFIG_DIR=${DATA_DIR})`);
});

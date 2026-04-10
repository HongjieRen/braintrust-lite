import { spawn } from 'child_process';

// ─── Provider argv constants ──────────────────────────────────────────────────

export const CODEX_ARGS_PREFIX = ['exec', '--json', '--skip-git-repo-check', '--ephemeral'];
export const GEMINI_ARGS_PREFIX = ['-o', 'json', '--allowed-mcp-server-names', 'sequential-thinking'];

// ─── Process runner ───────────────────────────────────────────────────────────

/**
 * Spawn a subprocess with an AbortController-based timeout.
 * Returns { stdout, stderr, code } — never rejects.
 */
export function runProcess(cmd, args, { cwd, timeoutMs } = {}) {
  const ac = new AbortController();
  const proc = spawn(cmd, args, {
    signal: ac.signal,
    stdio: ['ignore', 'pipe', 'pipe'],
    ...(cwd ? { cwd } : {}),
  });

  let stdout = '';
  let stderr = '';
  proc.stdout.on('data', d => { stdout += d; });
  proc.stderr.on('data', d => { stderr += d; });

  const timer = timeoutMs ? setTimeout(() => ac.abort(), timeoutMs) : null;

  return new Promise(resolve => {
    const done = code => {
      if (timer) clearTimeout(timer);
      resolve({ stdout, stderr, code });
    };
    proc.on('close', done);
    proc.on('error', err => done(err.name === 'AbortError' ? 'timeout' : -1));
  });
}

// ─── Adapters ─────────────────────────────────────────────────────────────────

/** Last-resort: take the tail of raw stdout. */
export function fallback(rawStdout) {
  return { content: rawStdout.slice(-2000).trim() || '[no output]', parse_mode: 'fallback' };
}

/** Parse Codex JSONL stream → extract the last agent_message text. */
export function adaptCodex(raw) {
  try {
    const events = raw.stdout.trim().split('\n').flatMap(l => {
      try { return [JSON.parse(l)]; } catch { return []; }
    });
    const msg = events.filter(e => e.type === 'item.completed' && e.item?.type === 'agent_message').pop()
      ?? events.filter(e => e.type === 'item.completed').pop();
    if (msg?.item?.text) return { content: msg.item.text, parse_mode: 'jsonl' };
  } catch { /* fall through */ }
  return fallback(raw.stdout);
}

/** Skip any MCP startup noise before the first '{', then extract .response */
export function parseGeminiResponse(stdout) {
  const jsonStart = stdout.indexOf('{');
  if (jsonStart === -1) return null;
  const j = JSON.parse(stdout.slice(jsonStart));
  if (typeof j.response === 'string') return j.response;
  for (const v of Object.values(j)) {
    if (v && typeof v === 'object' && typeof v.response === 'string') return v.response;
  }
  return null;
}

/** Parse Gemini JSON output → content string. */
export function adaptGemini(raw) {
  try {
    const response = parseGeminiResponse(raw.stdout);
    if (response) return { content: response, parse_mode: 'json' };
  } catch { /* fall through */ }
  return fallback(raw.stdout);
}

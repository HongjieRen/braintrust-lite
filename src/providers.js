import { spawn } from 'child_process';

// ─── Provider argv constants ──────────────────────────────────────────────────

export const CODEX_ARGS_PREFIX = ['exec', '--json', '--skip-git-repo-check', '--ephemeral'];
export const GEMINI_ARGS_PREFIX = ['-o', 'json'];
export const CLAUDE_ARGS_PREFIX = ['--output-format', 'json', '-p'];

// ─── Process runner ───────────────────────────────────────────────────────────

/**
 * Spawn a subprocess with an AbortController-based timeout.
 * Returns { stdout, stderr, code, error_type } — never rejects.
 * error_type: 'enoent' | 'timeout' | 'nonzero' | 'spawn_error' | null
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
    let resolved = false;
    const done = (code, error_type = null) => {
      if (resolved) return;
      resolved = true;
      if (timer) clearTimeout(timer);
      resolve({ stdout, stderr, code, error_type });
    };
    proc.on('close', code => done(code, code !== 0 ? 'nonzero' : null));
    proc.on('error', err => {
      if (err.name === 'AbortError') done('timeout', 'timeout');
      else if (err.code === 'ENOENT') done(-1, 'enoent');
      else done(-1, 'spawn_error');
    });
  });
}

// ─── Adapters ─────────────────────────────────────────────────────────────────

export function fallback(rawStdout) {
  return { content: rawStdout.slice(-2000).trim() || '[no output]', parse_mode: 'fallback' };
}

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

export function adaptGemini(raw) {
  try {
    const response = parseGeminiResponse(raw.stdout);
    if (response) return { content: response, parse_mode: 'json' };
  } catch { /* fall through */ }
  return fallback(raw.stdout);
}

export function adaptClaude(raw) {
  try {
    const j = JSON.parse(raw.stdout);
    if (typeof j.result === 'string') return { content: j.result, parse_mode: 'json' };
  } catch { /* fall through */ }
  return fallback(raw.stdout);
}

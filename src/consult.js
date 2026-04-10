import {
  runProcess,
  adaptCodex,
  adaptGemini,
  CODEX_ARGS_PREFIX,
  GEMINI_ARGS_PREFIX,
} from './providers.js';

const SYSTEM_PROMPT = `你是一个独立思考的高级专家。请基于自己的判断给出高质量、可执行的回答。
要求：独立思考，不假设其他专家会补充；区分结论、依据、假设、风险；简洁但完整。`;

const PROVIDERS = {
  codex: {
    cmd: 'codex',
    buildArgs: prompt => [...CODEX_ARGS_PREFIX, `${SYSTEM_PROMPT}\n\n${prompt}`],
    adapt: adaptCodex,
  },
  gemini: {
    cmd: 'gemini',
    buildArgs: prompt => ['-p', `${SYSTEM_PROMPT}\n\n${prompt}`, ...GEMINI_ARGS_PREFIX],
    adapt: adaptGemini,
  },
};

/**
 * Run a single provider and return a normalized result object.
 * Never throws — errors are captured in the `error` field.
 */
async function runOne(name, prompt, { cwd, timeoutMs }) {
  const p = PROVIDERS[name];
  const start = Date.now();
  const raw = await runProcess(p.cmd, p.buildArgs(prompt), { cwd, timeoutMs });
  const duration_ms = Date.now() - start;

  const error = raw.code === 'timeout' ? 'timeout'
    : raw.code !== 0 ? `exit ${raw.code}`
    : null;

  const { content } = error ? { content: '' } : p.adapt(raw);
  return { provider: name, content, duration_ms, error };
}

/**
 * Consult Codex and/or Gemini in parallel.
 *
 * @param {object} opts
 * @param {string}   opts.prompt       - The question to ask.
 * @param {string}   [opts.only]       - 'codex' | 'gemini' — only run this one.
 * @param {string[]} [opts.skip]       - Providers to skip.
 * @param {number}   [opts.timeoutMs]  - Per-provider timeout in ms (default 90 000).
 * @param {string}   [opts.cwd]        - Working directory for subprocesses.
 * @returns {Promise<Array<{provider, content, duration_ms, error}>>}
 */
export async function consult({ prompt, only, skip = [], timeoutMs = 90_000, cwd } = {}) {
  const targets = Object.keys(PROVIDERS)
    .filter(name => (only ? name === only : true))
    .filter(name => !skip.includes(name));

  if (targets.length === 0) {
    throw new Error('No providers selected — check --only / --skip flags.');
  }

  const settled = await Promise.allSettled(
    targets.map(name => runOne(name, prompt, { cwd, timeoutMs }))
  );

  return targets.map((name, i) =>
    settled[i].status === 'fulfilled'
      ? settled[i].value
      : { provider: name, content: '', duration_ms: 0, error: settled[i].reason?.message ?? 'unknown' }
  );
}

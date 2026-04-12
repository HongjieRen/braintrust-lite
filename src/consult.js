import {
  runProcess,
  adaptCodex, adaptGemini, adaptClaude,
  CODEX_ARGS_PREFIX, GEMINI_ARGS_PREFIX, CLAUDE_ARGS_PREFIX,
} from './providers.js';

const SYSTEM_PROMPT = `你是一个独立思考的高级专家。请基于自己的判断给出高质量、可执行的回答。
要求：独立思考，不假设其他专家会补充；区分结论、依据、假设、风险；简洁但完整。`;

const PROVIDERS = {
  codex:  { cmd: 'codex',  buildArgs: p => [...CODEX_ARGS_PREFIX,  `${SYSTEM_PROMPT}\n\n${p}`], adapt: adaptCodex  },
  gemini: { cmd: 'gemini', buildArgs: p => ['-p', `${SYSTEM_PROMPT}\n\n${p}`, ...GEMINI_ARGS_PREFIX], adapt: adaptGemini },
  claude: { cmd: 'claude', buildArgs: p => [...CLAUDE_ARGS_PREFIX,  `${SYSTEM_PROMPT}\n\n${p}`], adapt: adaptClaude },
};

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function anonymize(results) {
  const labels = ['Model A', 'Model B', 'Model C', 'Model D', 'Model E'];
  const shuffled = shuffle([...results]);
  const mapping = {};
  const anonymized = shuffled.map((r, i) => {
    mapping[labels[i]] = r.provider;
    return { ...r, provider: labels[i] };
  });
  return { results: anonymized, mapping };
}

async function runOne(name, prompt, { cwd, timeoutMs }) {
  const p = PROVIDERS[name];
  const start = Date.now();
  const raw = await runProcess(p.cmd, p.buildArgs(prompt), { cwd, timeoutMs });
  const duration_ms = Date.now() - start;

  const error_type = raw.error_type || null;
  const error = error_type === 'enoent' ? 'not installed'
    : error_type === 'timeout' ? 'timeout'
    : error_type === 'nonzero' ? `exit ${raw.code}`
    : error_type ? error_type
    : null;

  const { content } = error ? { content: '' } : p.adapt(raw);
  return { provider: name, content, duration_ms, error, error_type };
}

/**
 * Consult Codex, Gemini, and/or Claude in parallel.
 * Returns { results, mapping, successCount, totalCount }
 */
export async function consult({ prompt, only, skip = [], timeoutMs = 90_000, cwd, blind = true } = {}) {
  const targets = Object.keys(PROVIDERS)
    .filter(name => (only ? name === only : true))
    .filter(name => !skip.includes(name));

  if (targets.length === 0) throw new Error('No providers selected — check --only / --skip flags.');

  const settled = await Promise.allSettled(
    targets.map(name => runOne(name, prompt, { cwd, timeoutMs }))
  );

  const results = targets.map((name, i) =>
    settled[i].status === 'fulfilled'
      ? settled[i].value
      : { provider: name, content: '', duration_ms: 0, error: 'rejected', error_type: 'rejected' }
  );

  const successCount = results.filter(r => !r.error).length;
  const totalCount = results.length;

  if (blind) {
    const { results: anon, mapping } = anonymize(results);
    return { results: anon, mapping, successCount, totalCount };
  }
  return { results, mapping: null, successCount, totalCount };
}

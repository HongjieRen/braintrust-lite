#!/usr/bin/env node
import { mkdirSync, writeFileSync, existsSync, readFileSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import https from 'https';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR  = join(process.env.HOME || '/tmp', '.claude', 'skills', 'consult');
const SKILL_PATH = join(SKILL_DIR, 'SKILL.md');
const SKILL_URL  = 'https://raw.githubusercontent.com/HongjieRen/braintrust-lite/main/skills/consult/SKILL.md';
const G = '\x1b[32m✓\x1b[0m', R = '\x1b[31m✗\x1b[0m';

function fetch(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 10000 }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) return fetch(res.headers.location).then(resolve).catch(reject);
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      let body = ''; res.on('data', d => { body += d; }); res.on('end', () => resolve(body));
    });
    req.on('error', reject); req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function getVersion(p) { try { return (readFileSync(p,'utf8').match(/^version:\s*(.+)$/m)||[])[1]?.trim(); } catch { return null; } }

console.log('\nbraintrust-lite setup\n');
console.log('Installing consult skill:');
mkdirSync(SKILL_DIR, { recursive: true });
if (existsSync(SKILL_PATH)) copyFileSync(SKILL_PATH, SKILL_PATH + '.bak');

const bundled = join(__dirname, '..', 'skills', 'consult', 'SKILL.md');
if (existsSync(bundled)) {
  copyFileSync(bundled, SKILL_PATH);
  console.log(`  ${G}  SKILL.md installed  (v${getVersion(SKILL_PATH)})`);
} else {
  try {
    const content = await fetch(SKILL_URL);
    writeFileSync(SKILL_PATH, content, 'utf8');
    console.log(`  ${G}  SKILL.md downloaded from GitHub  (v${getVersion(SKILL_PATH)})`);
  } catch(e) {
    console.log(`  ${R}  SKILL.md download failed: ${e.message}`);
    process.exitCode = 1;
  }
}

console.log('\nRegistering MCP server:');
const claudeOk = spawnSync('claude', ['--version'], { timeout: 5000 }).status === 0;
if (!claudeOk) {
  console.log(`  ${R}  claude CLI not found — install Claude Code first`);
  console.log(`       Then: claude mcp add braintrust-lite -- npx -y braintrust-lite@~0.1`);
  process.exitCode = 1;
} else {
  const list = spawnSync('claude', ['mcp', 'list'], { encoding: 'utf8', timeout: 5000 });
  if ((list.stdout || '').includes('braintrust-lite')) {
    console.log(`  ${G}  MCP server already registered`);
  } else {
    const r = spawnSync('claude', ['mcp', 'add', 'braintrust-lite', '--', 'npx', '-y', 'braintrust-lite@~0.1'], { encoding: 'utf8', timeout: 10000 });
    if (r.status === 0) console.log(`  ${G}  MCP server registered  (npx braintrust-lite@~0.1)`);
    else { console.log(`  ${R}  MCP registration failed`); console.log(`       Manual: claude mcp add braintrust-lite -- npx -y braintrust-lite@~0.1`); process.exitCode = 1; }
  }
}

console.log();
console.log(process.exitCode ? '  \x1b[33mSetup done with warnings — fix issues above.\x1b[0m' : '  \x1b[32mDone! Restart Claude Code, then use /consult.\x1b[0m');
console.log();

/**
 * Format provider results as human-readable Markdown with run manifest.
 */
export function formatAsMarkdown(results, mapping = null, { successCount, totalCount } = {}) {
  const total = totalCount ?? results.length;
  const succeeded = successCount ?? results.filter(r => !r.error).length;
  const degraded = succeeded < total;

  // Status line (mirrors SKILL.md status bar format)
  const modelsLabel = degraded ? `⚠ ${succeeded}/${total} models` : `${total} models`;
  const statusLine = `[Consult | ${modelsLabel} | responses below]\n`;

  const body = results.map(r => {
    const label = r.error
      ? `## ${r.provider} (${r.error})`
      : `## ${r.provider} (${(r.duration_ms / 1000).toFixed(1)}s)`;
    const content = r.error ? `*调用失败: ${r.error}*` : r.content;
    return `${label}\n\n${content}`;
  }).join('\n\n---\n\n');

  const revealSection = mapping ? buildReveal(mapping) : '';
  const manifest = buildManifest(results, { successCount: succeeded, totalCount: total });

  return `${statusLine}\n${body}${revealSection}\n\n---\n\n${manifest}`;
}

function buildReveal(mapping) {
  const rows = Object.entries(mapping)
    .map(([label, provider]) => `| ${label} | **${provider}** |`)
    .join('\n');
  return `\n\n---\n\n## 🔒 REVEAL — 仅在完成评估后阅读

> **Judge 指令**：请先完成你的完整评估和综合输出，再阅读以下映射表，并在回复末尾告知用户每个模型对应的真实身份。

| 匿名标签 | 真实模型 |
|---------|---------|
${rows}`;
}

function buildManifest(results, { successCount, totalCount }) {
  const ts = new Date().toISOString().slice(0, 19) + 'Z';
  const degraded = successCount < totalCount;
  const lines = results.map(r =>
    r.error
      ? `  - ${r.provider}: ${r.error_type || r.error}`
      : `  - ${r.provider}: ${(r.duration_ms / 1000).toFixed(1)}s`
  ).join('\n');
  return `**Run manifest** · \`${ts}\` · ${successCount}/${totalCount} models${degraded ? ' ⚠ degraded' : ''}\n${lines}`;
}

export function formatAsJson(prompt, results, mapping = null) {
  return JSON.stringify({ prompt, results, mapping }, null, 2);
}

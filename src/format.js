/**
 * Format an array of provider results as human-readable Markdown.
 * Each provider gets a ## header with timing (or error), then its content.
 *
 * When a mapping is provided (blind mode), a REVEAL section is appended
 * at the end so the Judge can disclose model identity to the user AFTER
 * completing their evaluation.
 */
export function formatAsMarkdown(results, mapping = null) {
  const body = results.map(r => {
    const label = r.error
      ? `## ${r.provider} (${r.error})`
      : `## ${r.provider} (${(r.duration_ms / 1000).toFixed(1)}s)`;
    const content = r.error ? `*调用失败: ${r.error}*` : r.content;
    return `${label}\n\n${content}`;
  }).join('\n\n---\n\n');

  if (!mapping) return body;

  const reveal = Object.entries(mapping)
    .map(([label, provider]) => `| ${label} | **${provider}** |`)
    .join('\n');

  return `${body}

---

## 🔒 REVEAL — 仅在完成评估后阅读

> **Judge 指令**：请先完成你的完整评估和综合输出，再阅读以下映射表，并在回复末尾告知用户每个模型对应的真实身份。

| 匿名标签 | 真实模型 |
|---------|---------|
${reveal}`;
}

/**
 * Format results as a compact JSON string for programmatic consumption.
 */
export function formatAsJson(prompt, results, mapping = null) {
  return JSON.stringify({ prompt, results, mapping }, null, 2);
}

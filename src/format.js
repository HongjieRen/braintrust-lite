/**
 * Format an array of provider results as human-readable Markdown.
 * Each provider gets a ## header with timing (or error), then its content.
 */
export function formatAsMarkdown(results) {
  return results.map(r => {
    const label = r.error
      ? `## ${r.provider.toUpperCase()} (${r.error})`
      : `## ${r.provider.toUpperCase()} (${(r.duration_ms / 1000).toFixed(1)}s)`;
    const body = r.error ? `*调用失败: ${r.error}*` : r.content;
    return `${label}\n\n${body}`;
  }).join('\n\n---\n\n');
}

/**
 * Format results as a compact JSON string for programmatic consumption.
 */
export function formatAsJson(prompt, results) {
  return JSON.stringify({ prompt, results }, null, 2);
}

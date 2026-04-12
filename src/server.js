#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { consult } from './consult.js';
import { formatAsMarkdown } from './format.js';

const CONSULT_TOOL = {
  name: 'consult',
  description: '并发调用 Codex、Gemini、Claude CLI，获取三个模型的独立视角。适合架构选型、方案设计、技术决策、复杂调研。调用方担任 Judge 盲评综合输出。不适合：typo 修复、单行改动、只读查询。',
  inputSchema: {
    type: 'object',
    properties: {
      prompt:      { type: 'string',  description: '要问各模型的问题，建议精炼自包含。' },
      only:        { type: 'string',  enum: ['codex', 'gemini', 'claude'], description: '只调用指定一个模型。' },
      skip:        { type: 'array',   items: { type: 'string', enum: ['codex', 'gemini', 'claude'] }, description: '跳过指定模型。' },
      timeout_sec: { type: 'number',  description: '每个模型超时秒数，默认 90。0 = 不限时。' },
      blind:       { type: 'boolean', description: '匿名化 provider 名称（默认 true）。' },
      cwd:         { type: 'string',  description: '子进程工作目录。' },
    },
    required: ['prompt'],
  },
};

const server = new Server(
  { name: 'braintrust-lite', version: '0.1.7' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [CONSULT_TOOL] }));

server.setRequestHandler(CallToolRequestSchema, async req => {
  if (req.params.name !== 'consult') throw new Error(`Unknown tool: ${req.params.name}`);

  const args = req.params.arguments ?? {};
  const timeoutMs = args.timeout_sec != null
    ? (Number(args.timeout_sec) === 0 ? 0 : Number(args.timeout_sec) * 1000)
    : 90_000;

  const { results, mapping, successCount, totalCount } = await consult({
    prompt:    String(args.prompt ?? ''),
    only:      args.only,
    skip:      Array.isArray(args.skip) ? args.skip : [],
    timeoutMs,
    blind:     args.blind !== false,
    cwd:       args.cwd,
  });

  if (results.every(r => r.error)) {
    const detail = results.map(r => `${r.provider}=${r.error_type || r.error}`).join(', ');
    throw new Error(`All providers failed: ${detail}`);
  }

  return {
    content: [{ type: 'text', text: formatAsMarkdown(results, mapping, { successCount, totalCount }) }],
  };
});

const transport = new StdioServerTransport();
await server.connect(transport);

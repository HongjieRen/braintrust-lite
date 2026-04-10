#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { consult } from './consult.js';
import { formatAsMarkdown } from './format.js';

// ─── Tool definition ──────────────────────────────────────────────────────────

const CONSULT_TOOL = {
  name: 'consult',
  description:
    '并发调用 Codex 和 Gemini CLI，获取两个顶尖模型对同一问题的独立视角。' +
    '适合架构选型、方案设计、技术决策、复杂调研。' +
    '调用方（通常是主 Claude）负责综合融合输出，自己担任 Judge。' +
    '不适合：typo 修复、单行改动、只读信息查询。',
  inputSchema: {
    type: 'object',
    properties: {
      prompt: {
        type: 'string',
        description: '要问两个模型的问题。建议精炼、自包含（含必要上下文）。',
      },
      only: {
        type: 'string',
        enum: ['codex', 'gemini'],
        description: '只调用指定一个模型（省成本或调试）。',
      },
      skip: {
        type: 'array',
        items: { type: 'string', enum: ['codex', 'gemini'] },
        description: '跳过指定模型列表。',
      },
      timeout_sec: {
        type: 'number',
        description: '每个模型的超时秒数，默认 90。',
      },
      cwd: {
        type: 'string',
        description: '子进程工作目录，默认继承 MCP server 的 cwd。',
      },
    },
    required: ['prompt'],
  },
};

// ─── Server setup ─────────────────────────────────────────────────────────────

const server = new Server(
  { name: 'braintrust-lite', version: '0.1.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [CONSULT_TOOL],
}));

server.setRequestHandler(CallToolRequestSchema, async req => {
  if (req.params.name !== 'consult') {
    throw new Error(`Unknown tool: ${req.params.name}`);
  }

  const args = req.params.arguments ?? {};
  const results = await consult({
    prompt: String(args.prompt ?? ''),
    only: args.only,
    skip: Array.isArray(args.skip) ? args.skip : [],
    timeoutMs: args.timeout_sec ? Number(args.timeout_sec) * 1000 : 90_000,
    cwd: args.cwd,
  });

  if (results.every(r => r.error)) {
    throw new Error(
      `All providers failed: ${results.map(r => `${r.provider}=${r.error}`).join(', ')}`
    );
  }

  return {
    content: [{ type: 'text', text: formatAsMarkdown(results) }],
  };
});

// ─── Start ────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);

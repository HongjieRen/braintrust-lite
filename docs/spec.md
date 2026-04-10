# braintrust-lite — 设计文档

## 背景

`braintrust`（4 次 API 调用，3 generator + 1 judge）适合终端独立使用，但对于嵌入 Claude Code 工作流来说偏重。

`braintrust-lite` 的目标：让 Claude Code 在调用子 agent 的同时，原生地拿到 Codex 和 Gemini 的独立视角，主 Claude 自己担任 Judge。

## 与 braintrust 的对比

| 特性 | braintrust | braintrust-lite |
|---|---|---|
| Generator 数 | 3 (claude+codex+gemini) | 2 (codex+gemini) |
| Judge | 独立 API 调用 | 主 Claude 本身 |
| API 调用 / 次 | 4 | 2 |
| 集成方式 | 终端 CLI | MCP tool（+ CLI fallback）|
| 落盘 | 默认开启 | 不落盘（stdout → Claude 上下文）|
| 归一化 | 有（key_claims 等） | 无（Claude 直读原文）|
| 代码量 | ~470 行单文件 | ~290 行，5 个模块 |

## 架构

```
Claude Code 主 Claude
  │
  ├─ Task(subagent_type=Plan, prompt=X)
  │
  └─ mcp__braintrust_lite__consult(prompt=X)
        │
        ├─ spawn: codex exec --json ...
        └─ spawn: gemini -p ... -o json
              │
              └─ Promise.allSettled → TextContent → 回到主 Claude

主 Claude 融合 (sub-agent 报告) + (codex) + (gemini) → 最终方案
```

## 模块职责

### `src/providers.js`
底层工具：`runProcess`（spawn + AbortController 超时）和各 provider 的输出解析器（`adaptCodex`、`adaptGemini`）。直接从 `braintrust` 移植，改为 ESM。

### `src/consult.js`
核心逻辑：接收 `{ prompt, only, skip, timeoutMs, cwd }`，并发调用目标 providers，返回结构化结果数组。所有函数纯函数、不可变。

### `src/format.js`
渲染层：`formatAsMarkdown`（MCP 和 CLI 默认）、`formatAsJson`（CLI `--json` 模式）。

### `src/server.js`
MCP stdio server。注册单一 tool `consult`，处理 `tools/list` 和 `tools/call`。

### `bin/consult`
薄 CLI 包装。Shebang Node，解析 argv，调 `consult()`，输出格式化结果。作为终端 fallback 和调试工具。

## Prompt 设计原则

- Generator prompt 极简（不要求结构化输出标签）——Claude 自己负责融合，不需要 normalize 层
- 去掉 braintrust 的 `[核心结论]` / `[关键假设]` 段落强制要求，让模型自由发挥，保留更多信号

## 容错

- `Promise.allSettled`：一个 provider 失败不影响另一个
- 两个都失败：MCP 返回 error，主 Claude 感知并降级处理
- 超时：`AbortController`，默认 90s

## 成本估算

| 场景 | 调用次数 | 估算成本 |
|---|---|---|
| 简单问题 | 2 | $0.05–0.15 |
| 中等问题 | 2 | $0.15–0.40 |
| 复杂问题 | 2 | $0.40–0.80 |

## 后续演进方向

1. 支持更多 provider（Goose、本地 Ollama 等）
2. `timeout_sec` 按 provider 独立配置
3. 结果缓存（相同 prompt 跳过重复调用）
4. 流式输出（SSE / streaming MCP）
5. `--strict` 模式：加一次 Claude judge，对齐 braintrust 的完整流水线

# braintrust-lite

Claude Code 原生的多模型军师 — 并发调用 Codex + Gemini，主 Claude 担任 Judge 融合输出。

```
主 Claude → parallel:
  ├─ Task(subagent_type=Plan, prompt=X)       ← 正常子 agent
  └─ mcp__braintrust_lite__consult(prompt=X) ← Codex + Gemini 旁路咨询
          → 主 Claude 融合三方视角 → 最终方案
```

vs [`braintrust`](https://github.com/HongjieRen/braintrust): 2 次 API 调用（省 50%），无独立 Judge，无落盘，原生集成 Claude Code。

---

## 安装

**前置条件**：`codex` 和 `gemini` CLI 均已登录。

```bash
# 克隆
git clone https://github.com/HongjieRen/braintrust-lite.git
cd braintrust-lite

# 安装依赖
npm install

# 可选：把 CLI 软链到 PATH
ln -sf "$(pwd)/bin/consult" ~/.local/bin/consult
chmod +x bin/consult
```

---

## 注册到 Claude Code（MCP）

```bash
claude mcp add braintrust-lite node "$(pwd)/src/server.js"
```

注册后，Claude Code 会话里会出现 `mcp__braintrust_lite__consult` tool，和 `Read` / `Bash` 并列可用。

重启 Claude Code 后生效。

---

## 安装 Skill 引导

将 skill 复制到 Claude Code 全局 skill 目录（注意：不能用 symlink，路径含空格时 Claude Code 无法识别）：

```bash
mkdir -p ~/.claude/skills/consult
cp "$(pwd)/skills/consult/SKILL.md" ~/.claude/skills/consult/SKILL.md
```

安装后重启 Claude Code，`/consult` slash command 即可生效。

**更新 skill**：每次修改 `skills/consult/SKILL.md` 后重新 cp 一次并重启 Claude Code。

---

## 使用方式

### 在 Claude Code 里（推荐）

Claude 会在处理规划/设计类任务时自动（或在 `/consult` 引导下）并发调用：

```
你处理一个架构选型任务时，Claude 会同时：
  1. 启动 Plan sub-agent 做深度分析
  2. 调用 mcp__braintrust_lite__consult 获取 Codex + Gemini 的独立视角
  3. 融合三方输出给你最终方案
```

### 终端 CLI（fallback / 调试）

```bash
consult "解释 CAP 定理"                   # 并发两模型，markdown 输出
consult --only codex "prompt"             # 只跑 codex
consult --skip gemini "prompt"            # 跳过 gemini
consult --timeout 60 "prompt"             # 超时秒数
consult --dir ~/myproject "review"        # 工作目录
cat app.ts | consult "review this code"   # stdin 拼接
consult --json "prompt"                   # JSON 结构化输出
```

---

## 参数

| 参数 | 默认 | 说明 |
|---|---|---|
| `prompt` | 必须 | 问题文本（MCP）/ 位置参数（CLI）|
| `only` | — | 只调用: `codex` \| `gemini` |
| `skip` | — | 跳过模型列表 |
| `timeout_sec` | `90` | 每个模型超时秒数 |
| `cwd` | server cwd | 子进程工作目录 |
| `--json` | false | CLI 专用：JSON 格式输出 |

---

## 输出格式

```
## CODEX (8.2s)

<codex 完整回答>

---

## GEMINI (6.5s)

<gemini 完整回答>
```

失败的 provider 显示 `*调用失败: timeout*`，另一个照常返回（`Promise.allSettled` 容错）。

---

## 架构

```
braintrust-lite/
├── src/
│   ├── server.js      MCP stdio server
│   ├── consult.js     核心并发逻辑
│   ├── providers.js   spawn + Codex/Gemini 解析器
│   └── format.js      Markdown / JSON 渲染
├── bin/
│   └── consult        CLI 入口
├── skills/
│   └── consult/
│       └── SKILL.md   Claude Code skill 引导
└── docs/
    └── spec.md        设计文档
```

---

## 成本

| 场景 | API 调用 | 估算成本 |
|---|---|---|
| 简单问题 | 2 | $0.05–0.15 |
| 中等问题 | 2 | $0.15–0.40 |
| 复杂问题 | 2 | $0.40–0.80 |

---

## License

MIT

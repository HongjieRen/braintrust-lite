---
name: consult
description: 在处理规划/设计/架构/调研类任务时，并发调用 codex + gemini + claude 获取多视角，主 Claude 担任 Judge 盲评综合输出。
---

# consult — 多模型旁路军师

## 这是什么

`braintrust-lite` 提供的 MCP tool `mcp__braintrust_lite__consult` 会在后台并发调用 **Codex CLI**、**Gemini CLI** 和 **Claude CLI**，把三个顶尖模型的独立回答以匿名形式（Model A/B/C）交回给你。

你（主 Claude）负责担任 Judge——盲评内容，提炼共识、标注独特洞见、裁决分歧，输出集大成方案。不需要额外的 Judge API 调用。

## 何时使用

对以下类型的任务，**在启动子 agent 的同时并行调用 consult**：

- 架构选型、技术选型、框架比较
- 方案设计（新功能、重大重构、系统集成）
- 复杂 bug 根因分析（多种假设并存时）
- 非显而易见的技术决策（有明显 trade-off 的场景）
- 安全或性能评审

## 何时跳过

- typo 修复、单行改动、简单 rename
- 只读信息查询（用 Grep / Read 就够）
- 用户已经明确指定方案，不需要二次意见
- 已知有标准答案的操作性任务

## 工作流（重要）

```
1. 发一条 message，同时 parallel call：
   ├─ Task(subagent_type=Plan/Explore/..., prompt=X)
   └─ mcp__braintrust_lite__consult(prompt=X)    ← 同一个核心问题

2. 等两者都返回后，你亲自担任 Judge（盲评流程）：

   步骤一：只看 Model A/B/C 的内容，完成完整评估：
   ├─ 核心共识：多方都认同的结论
   ├─ 独特洞见：某一方独有但有价值的内容
   ├─ 分歧裁决：矛盾处给出判断和理由
   └─ 集大成方案：综合最优可执行方案

   步骤二：评估写完后，读 REVEAL 区块中的映射表

   步骤三：在回复末尾附上揭晓信息，告诉用户每个模型的真实身份：
   例如："揭晓：Model A = Gemini，Model B = Claude，Model C = Codex"

3. 输出给用户时：
   - 不要把 consult 原文整段贴出——你是 Judge，提炼后输出
   - 评估内容用 Model A/B/C 标注，揭晓后用真实名称
```

## consult tool 参数

```
prompt      (必须) 问题，建议精炼、自包含，含必要上下文
only        (可选) "codex" | "gemini" | "claude" — 只调用一个
skip        (可选) ["codex"] | ["gemini"] | ["claude"] — 跳过某个
timeout_sec (可选) 每个模型超时秒数，默认 90；传 0 = 不限时等待完成
blind       (可选) 默认 true；传 false 可直接看真实模型名称
cwd         (可选) 子进程工作目录
```

## timeout 选择策略（重要）

**你（主 Claude）负责决定 timeout_sec，用户不需要指定：**

| 任务类型 | timeout_sec | 示例 |
|---------|------------|------|
| 深度调研、市场分析、可行性研究 | **0**（不限时） | "帮我调研 X 的可行性" |
| 架构设计、复杂方案对比 | **0**（不限时） | "设计一个 Y 系统" |
| 代码审查、技术选型 | 180 | "这段代码有什么问题" |
| 简单问答、快速决策 | 90（默认） | "用 A 还是 B" |

调研类任务模型需要联网搜索，耗时不可预测，**一律传 `timeout_sec: 0`**。

## 成本与延迟

- 每次 consult = 3 次 API 调用（codex + gemini + claude）
- 延迟 = `max(三者响应时间)`（并发）
- 简单问题 ~$0.05–0.20，中等 ~$0.20–0.50

## 终端 fallback

不在 Claude Code 里时，直接用 CLI：

```bash
consult "你的问题"
consult --only codex "快速问题"
consult --skip gemini "prompt"
consult --timeout 60 "prompt"
consult --timeout 0 "深度调研问题"   # 不限时
consult --dir /your/project "review this project"
cat file.ts | consult "review this code"
consult --json "prompt"   # 结构化 JSON 输出
```

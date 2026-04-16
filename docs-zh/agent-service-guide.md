# 基于 DeepAgentsJS 构建智能体服务 — 完整开发指南

## 1. 概述

本文档详述如何基于 `deepagentsjs` 项目扩展开发一个对外提供 HTTP API 的智能体服务。最终产物是一个使用 **Hono** 框架暴露 REST/SSE 接口、内部调用 `createDeepAgent` 核心 API 的可独立部署的服务。

### 架构总览

```
┌─────────────────────────────────────────────────────┐
│                   客户端 / 前端                       │
│            (浏览器、移动端、CLI 等)                    │
└──────────────────────┬──────────────────────────────┘
                       │  HTTP / SSE
┌──────────────────────▼──────────────────────────────┐
│               Hono HTTP 服务层                       │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ /chat    │  │ /stream  │  │ /agents/:id/invoke│  │
│  └────┬─────┘  └────┬─────┘  └────────┬──────────┘  │
│       │              │                 │             │
│  ┌────▼──────────────▼─────────────────▼──────────┐  │
│  │            DeepAgent 实例管理层                  │  │
│  │  createDeepAgent({ model, tools, middleware })  │  │
│  └────────────────────┬───────────────────────────┘  │
│                       │                              │
│  ┌────────────────────▼───────────────────────────┐  │
│  │  中间件栈 (Middleware Stack)                     │  │
│  │  • TodoList  • Filesystem  • SubAgents          │  │
│  │  • Skills    • Memory      • Summarization      │  │
│  │  • 自定义中间件 ...                               │  │
│  └────────────────────┬───────────────────────────┘  │
│                       │                              │
│  ┌────────────────────▼───────────────────────────┐  │
│  │  后端存储层 (Backends)                           │  │
│  │  StateBackend / FilesystemBackend / StoreBackend │  │
│  └────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

---

## 2. 前置准备

### 2.1 环境要求

- **Bun** >= 1.x（运行时与包管理器）
- **Node.js** >= 20（部分依赖兼容需要）
- 一个 LLM API Key（如 `ANTHROPIC_API_KEY` 或 `OPENAI_API_KEY`）

### 2.2 初始化项目结构

在 Monorepo 内新建服务目录（推荐放在 `examples/` 或独立的 `services/` 目录下）：

```bash
# 在项目根目录下
mkdir -p services/my-agent-service/src
cd services/my-agent-service
```

初始化 `package.json`：

```bash
bun init
```

安装核心依赖：

```bash
# 核心框架
bun add hono deepagents

# LLM Provider（根据需要选择）
bun add @langchain/anthropic
# 或
bun add @langchain/openai

# 可选的工具依赖
bun add @langchain/tavily  # 网页搜索
bun add zod                # Schema 定义
bun add dotenv             # 环境变量

# 开发依赖
bun add -d typescript @types/node
```

推荐的目录结构：

```
services/my-agent-service/
├── src/
│   ├── index.ts            # Hono 服务入口
│   ├── agents/             # Agent 定义与配置
│   │   ├── research.ts     # 调研 Agent
│   │   └── assistant.ts    # 通用助手 Agent
│   ├── tools/              # 自定义工具
│   │   ├── search.ts
│   │   └── database.ts
│   ├── middleware/          # 自定义中间件
│   │   └── auth.ts
│   ├── skills/             # 技能文件 (SKILL.md)
│   │   └── web-research/
│   │       └── SKILL.md
│   └── routes/             # Hono 路由
│       ├── chat.ts
│       └── stream.ts
├── package.json
├── tsconfig.json
└── .env
```

---

## 3. 核心概念与 API 详解

### 3.1 `createDeepAgent` — 核心入口

`createDeepAgent` 是整个框架的核心函数。它返回一个编译后的 LangGraph 图（`ReactAgent`），内置了规划、文件系统操作、子代理委派等能力。

```typescript
import { createDeepAgent } from "deepagents";

const agent = createDeepAgent({
  // 模型配置（默认 claude-sonnet-4-6）
  model: "anthropic:claude-sonnet-4-6",

  // 自定义工具
  tools: [myTool1, myTool2],

  // 系统提示词
  systemPrompt: "你是一个专业的研究助手。",

  // 子代理列表
  subagents: [researchSubAgent, critiqueSubAgent],

  // 自定义中间件
  middleware: [myCustomMiddleware],

  // 记忆文件路径
  memory: ["~/.deepagents/AGENTS.md"],

  // 技能目录
  skills: ["/skills/"],

  // 后端存储（默认 StateBackend）
  backend: (config) => new StateBackend(config),

  // 状态持久化
  checkpointer: myCheckpointer,

  // 长期记忆存储
  store: myStore,

  // 结构化输出格式
  responseFormat: myZodSchema,

  // Agent 名称
  name: "my-agent",
});
```

### 3.2 中间件系统（Middleware）

中间件是扩展 Agent 能力的核心机制。框架内置的中间件链按确定性顺序执行：

| 中间件 | 功能 | 是否内置 |
|--------|------|---------|
| `todoListMiddleware` | 任务规划与追踪 (`write_todos`) | ✅ 自动 |
| `createFilesystemMiddleware` | 文件读写操作 (`read_file`, `write_file`, `edit_file`, `ls`, `glob`, `grep`) | ✅ 自动 |
| `createSubAgentMiddleware` | 子代理委派（`task` 工具）| ✅ 自动 |
| `createSummarizationMiddleware` | 对话历史自动摘要压缩 | ✅ 自动 |
| `createPatchToolCallsMiddleware` | 跨模型工具调用兼容性修复 | ✅ 自动 |
| `createSkillsMiddleware` | 动态技能加载 | 可选 |
| `createMemoryMiddleware` | 长期记忆加载 | 可选 |
| `createAsyncSubAgentMiddleware` | 异步子代理桥接 | 可选 |
| `humanInTheLoopMiddleware` | 人工审核中断 | 可选 |
| 自定义中间件 | 你的业务逻辑 | 用户添加 |

**创建自定义中间件示例**：

```typescript
import { createMiddleware } from "langchain";
import { z } from "zod";

// 带有自定义状态的中间件
const myBusinessMiddleware = createMiddleware({
  name: "BusinessMiddleware",
  // 定义中间件自有状态
  stateSchema: z.object({
    analysisResult: z.string().default(""),
    processedCount: z.number().default(0),
  }),
  // 可以在这里注入额外工具或修改行为
});
```

### 3.3 后端存储抽象（Backends）

框架提供了多种后端，用于 Agent 的文件系统操作和状态管理：

| 后端 | 适用场景 |
|------|---------|
| `StateBackend` | **默认**。文件存储在 LangGraph 状态中，适合无状态部署 |
| `FilesystemBackend` | 文件存储在本地磁盘，适合需要持久化文件的场景 |
| `StoreBackend` | 文件存储在 LangGraph Store 中（如 LangSmith），适合云端部署 |
| `CompositeBackend` | 组合多个后端，按层级查找 |
| `LocalShellBackend` | 基于本地 Shell 执行命令，适合需要执行系统命令的场景 |
| `LangSmithSandbox` | LangSmith 托管的沙盒环境 |

```typescript
import { FilesystemBackend, CompositeBackend, StateBackend } from "deepagents";

// 使用文件系统后端
const fsBackend = new FilesystemBackend({ rootDir: "/data/agent-workspace" });

// 组合后端：先查 state，再查磁盘
const compositeBackend = new CompositeBackend([
  (config) => new StateBackend(config),
  fsBackend,
]);
```

### 3.4 子代理（SubAgents）

子代理允许主 Agent 将复杂任务委派给专门的助手：

```typescript
import type { SubAgent } from "deepagents";

const researchAgent: SubAgent = {
  name: "researcher",
  description: "用于深度调研某个主题，每次只处理一个问题。",
  systemPrompt: "你是一个专业的调研员...",
  tools: [searchTool],
  // 可选：子代理自己的中间件和技能
  middleware: [],
  skills: ["/skills/research/"],
};
```

### 3.5 技能系统（Skills）

技能是可动态加载的功能模块，通过 `SKILL.md` 文件定义：

```markdown
---
name: web-research
description: 搜索互联网并总结结果
---

# Web Research Skill

使用 `internet_search` 工具搜索互联网，并将结果整理为结构化报告。

## 使用步骤
1. 根据用户问题构造搜索查询
2. 调用搜索工具获取结果
3. 整理并总结搜索结果
```

---

## 4. 使用 Hono 构建 HTTP 服务

### 4.1 基础服务入口

```typescript
// src/index.ts
import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { chatRoute } from "./routes/chat";
import { streamRoute } from "./routes/stream";

const app = new Hono();

// 全局中间件
app.use("*", logger());
app.use("*", cors());

// 健康检查
app.get("/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }));

// 挂载路由
app.route("/api/chat", chatRoute);
app.route("/api/stream", streamRoute);

// 启动服务
const port = Number(process.env.PORT) || 3000;
console.log(`[INFO] Agent 服务启动于 http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
```

### 4.2 同步调用路由 (`invoke`)

```typescript
// src/routes/chat.ts
import { Hono } from "hono";
import { createAssistantAgent } from "../agents/assistant";

const chatRoute = new Hono();

chatRoute.post("/invoke", async (c) => {
  const body = await c.req.json();
  const { messages, threadId } = body;

  if (!messages || !Array.isArray(messages)) {
    return c.json({ error: "messages 字段缺失或格式错误" }, 400);
  }

  console.log(`[INFO] 收到对话请求, threadId=${threadId}, 消息数=${messages.length}`);

  try {
    const agent = createAssistantAgent();
    const result = await agent.invoke(
      { messages },
      {
        recursionLimit: 1000,
        configurable: { thread_id: threadId || crypto.randomUUID() },
      }
    );

    console.log(`[INFO] 对话完成, 回复消息数=${result.messages.length}`);

    return c.json({
      messages: result.messages,
      todos: result.todos,
      files: result.files,
    });
  } catch (error) {
    console.error("[ERROR] Agent 调用失败:", error);
    return c.json({ error: "Agent 处理失败" }, 500);
  }
});

export { chatRoute };
```

### 4.3 SSE 流式输出路由 (`stream`)

这是对外服务最关键的能力之一——实时流式返回 Agent 的思考与工具调用过程：

```typescript
// src/routes/stream.ts
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { createAssistantAgent } from "../agents/assistant";

const streamRoute = new Hono();

streamRoute.post("/invoke", async (c) => {
  const body = await c.req.json();
  const { messages, threadId } = body;

  if (!messages || !Array.isArray(messages)) {
    return c.json({ error: "messages 字段缺失或格式错误" }, 400);
  }

  console.log(`[INFO] 收到流式请求, threadId=${threadId}`);

  return streamSSE(c, async (stream) => {
    try {
      const agent = createAssistantAgent();
      const agentStream = await agent.stream(
        { messages },
        {
          streamMode: "updates",
          subgraphs: true,
          recursionLimit: 1000,
          configurable: { thread_id: threadId || crypto.randomUUID() },
        }
      );

      for await (const [namespace, chunk] of agentStream) {
        const source = namespace.length > 0 ? namespace.join("|") : "main";
        const eventData = {
          source,
          data: chunk,
          timestamp: new Date().toISOString(),
        };

        await stream.writeSSE({
          event: "agent-update",
          data: JSON.stringify(eventData),
        });
      }

      // 发送结束信号
      await stream.writeSSE({ event: "done", data: "[DONE]" });
      console.log(`[INFO] 流式输出完成`);
    } catch (error) {
      console.error("[ERROR] 流式处理失败:", error);
      await stream.writeSSE({
        event: "error",
        data: JSON.stringify({ error: "Agent 处理异常" }),
      });
    }
  });
});

export { streamRoute };
```

### 4.4 Agent 工厂模块

```typescript
// src/agents/assistant.ts
import { createDeepAgent, FilesystemBackend, type SubAgent } from "deepagents";
import { ChatAnthropic } from "@langchain/anthropic";
import { searchTool } from "../tools/search";

const researchSubAgent: SubAgent = {
  name: "researcher",
  description: "用于深度调研某个特定主题，一次只处理一个问题。",
  systemPrompt: "你是一个专业调研员，负责搜索并整理信息。",
  tools: [searchTool],
};

const critiqueSubAgent: SubAgent = {
  name: "critic",
  description: "用于审查和改进最终报告的质量。",
  systemPrompt: "你是一个严格的编辑，负责审查报告质量...",
};

export function createAssistantAgent() {
  const agent = createDeepAgent({
    model: new ChatAnthropic({
      model: "claude-sonnet-4-20250514",
      temperature: 0,
    }),
    systemPrompt: "你是一个专业的 AI 助手，可以帮助用户完成各类任务。",
    tools: [searchTool],
    subagents: [researchSubAgent, critiqueSubAgent],
    skills: ["/skills/"],
    backend: new FilesystemBackend({
      rootDir: process.env.AGENT_WORKSPACE || "/tmp/agent-workspace",
    }),
    name: "assistant",
  });

  return agent;
}
```

---

## 5. 进阶扩展

### 5.1 自定义工具开发

使用 LangChain 的 `tool` 函数定义工具，并通过 Zod 定义输入 Schema：

```typescript
// src/tools/search.ts
import { tool } from "langchain";
import { z } from "zod";

export const searchTool = tool(
  async ({ query, maxResults }) => {
    console.log(`[INFO] 执行搜索: query="${query}", maxResults=${maxResults}`);
    // 调用外部搜索 API ...
    const results = await callExternalSearchAPI(query, maxResults);
    console.log(`[INFO] 搜索完成, 返回 ${results.length} 条结果`);
    return JSON.stringify(results);
  },
  {
    name: "web_search",
    description: "搜索互联网获取最新信息",
    schema: z.object({
      query: z.string().describe("搜索关键词"),
      maxResults: z.number().optional().default(5).describe("最大返回结果数"),
    }),
  }
);
```

### 5.2 添加状态持久化（Checkpointer）

使用 LangGraph 的 checkpointer 在多轮对话间保持状态：

```typescript
import { MemorySaver } from "@langchain/langgraph-checkpoint";

// 简单的内存 checkpointer（生产环境建议使用 PostgreSQL/Redis）
const checkpointer = new MemorySaver();

const agent = createDeepAgent({
  model: "anthropic:claude-sonnet-4-6",
  checkpointer,
  // ...
});

// 使用 thread_id 跨请求保持对话状态
const result = await agent.invoke(
  { messages },
  { configurable: { thread_id: "user-session-123" } }
);
```

### 5.3 多 Agent 协作（层级架构）

```typescript
import { createDeepAgent, type SubAgent } from "deepagents";

// 定义专业子代理
const codeAgent: SubAgent = {
  name: "coder",
  description: "编写和修改代码",
  systemPrompt: "你是一个高级程序员...",
  tools: [codeExecutionTool],
};

const reviewAgent: SubAgent = {
  name: "reviewer",
  description: "代码审查和质量检查",
  systemPrompt: "你是一个严格的代码审查员...",
};

// 主 Agent 作为"主管"，自动委派任务
const supervisorAgent = createDeepAgent({
  systemPrompt: "你是项目经理，协调 coder 和 reviewer 完成开发任务。",
  subagents: [codeAgent, reviewAgent],
});
```

### 5.4 使用不同的 LLM Provider

```typescript
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";

// 使用 OpenAI
const agentGPT = createDeepAgent({
  model: new ChatOpenAI({ model: "gpt-4o", temperature: 0 }),
});

// 使用 Anthropic
const agentClaude = createDeepAgent({
  model: new ChatAnthropic({ model: "claude-sonnet-4-20250514" }),
});

// 使用字符串简写
const agentDefault = createDeepAgent({
  model: "anthropic:claude-sonnet-4-6",
});
```

### 5.5 结构化输出

让 Agent 返回符合 Zod Schema 的结构化数据：

```typescript
import { z } from "zod";
import { ToolStrategy } from "langchain";

const reportSchema = z.object({
  title: z.string().describe("报告标题"),
  summary: z.string().describe("摘要"),
  sections: z.array(z.object({
    heading: z.string(),
    content: z.string(),
  })),
  confidence: z.number().min(0).max(1).describe("置信度"),
});

const agent = createDeepAgent({
  responseFormat: ToolStrategy.fromSchema(reportSchema),
  // ...
});

const result = await agent.invoke({ messages });
// result.structuredResponse 的类型自动推导为 reportSchema 定义的形状
```

---

## 6. 运行与调试

### 6.1 开发模式启动

在 `package.json` 中配置脚本：

```json
{
  "scripts": {
    "dev": "bun run --watch src/index.ts",
    "dev:service": "bun run src/index.ts",
    "build": "bun build src/index.ts --outdir ./dist --target bun"
  }
}
```

配置环境变量 `.env`：

```bash
ANTHROPIC_API_KEY=sk-ant-xxx
# 或者
OPENAI_API_KEY=sk-xxx

PORT=3000
AGENT_WORKSPACE=/tmp/agent-workspace
```

启动服务：

```bash
bun run dev
```

### 6.2 测试 API

```bash
# 同步调用
curl -X POST http://localhost:3000/api/chat/invoke \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "你好，请帮我总结一下 LangGraph 的核心概念"}]}'

# 流式调用（SSE）
curl -N -X POST http://localhost:3000/api/stream/invoke \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "调研量子计算的最新进展"}]}'
```

### 6.3 LangSmith 可观测性

DeepAgentsJS 原生支持 LangSmith 追踪。设置以下环境变量即可启用：

```bash
LANGSMITH_API_KEY=lsv2_xxx
LANGSMITH_PROJECT=my-agent-service
LANGSMITH_TRACING=true
```

启用后，所有 Agent 的调用链路、工具执行、子代理委派都会自动上报到 LangSmith 平台，方便调试和性能分析。

---

## 7. 生产部署建议

### 7.1 并发与资源管理

- 每个请求创建独立的 Agent 实例，避免状态交叉污染
- 对于高并发场景，使用 Agent 实例池 + 分布式锁来限制并发数
- 设置合理的 `recursionLimit` 防止无限循环

### 7.2 日志规范

遵循项目日志规范，在关键节点添加日志：

```typescript
console.log(`[INFO] [AgentService] 收到请求, threadId=${threadId}`);
console.log(`[DEBUG] [AgentService] Agent 配置: model=${modelName}, tools=${toolCount}`);
console.error(`[ERROR] [AgentService] 调用异常:`, error.stack);
console.warn(`[WARN] [AgentService] 重试次数超过阈值: ${retryCount}`);
```

### 7.3 错误处理

```typescript
app.onError((err, c) => {
  console.error(`[ERROR] [Global] 未捕获异常:`, err.stack);
  return c.json({ error: "服务内部错误", message: err.message }, 500);
});
```

### 7.4 安全注意事项

> DeepAgentsJS 遵循"信任 LLM"模型。Agent 可以做其工具允许的任何事情。安全边界应在工具/沙盒层面实施，而非依赖模型自我约束。

- 在工具层面限制文件访问范围（使用 `FilesystemBackend` 的 `rootDir`）
- 对外部 API 调用设置超时和速率限制
- 不要在日志中记录 API Key 等敏感信息

---

## 8. 快速参考：完整最小示例

以下是一个可以直接运行的最小完整示例：

```typescript
// minimal-agent-service.ts
import "dotenv/config";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { createDeepAgent } from "deepagents";

const app = new Hono();

app.post("/chat", async (c) => {
  const { messages } = await c.req.json();
  const agent = createDeepAgent({ name: "assistant" });

  return streamSSE(c, async (stream) => {
    const agentStream = await agent.stream(
      { messages },
      { streamMode: "updates", subgraphs: true }
    );

    for await (const [ns, chunk] of agentStream) {
      await stream.writeSSE({
        event: "update",
        data: JSON.stringify({ source: ns.join("|") || "main", data: chunk }),
      });
    }
    await stream.writeSSE({ event: "done", data: "[DONE]" });
  });
});

export default { port: 3000, fetch: app.fetch };
// 启动: bun run minimal-agent-service.ts
```

---

## 附录 A：`createDeepAgent` 参数速查

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `model` | `string \| BaseLanguageModel` | `"anthropic:claude-sonnet-4-6"` | LLM 模型 |
| `tools` | `Tool[]` | `[]` | 自定义工具列表 |
| `systemPrompt` | `string \| SystemMessage` | 内置提示词 | 系统提示词 |
| `middleware` | `AgentMiddleware[]` | `[]` | 自定义中间件 |
| `subagents` | `(SubAgent \| AsyncSubAgent)[]` | `[]` | 子代理列表 |
| `responseFormat` | `SupportedResponseFormat` | - | 结构化输出 |
| `backend` | `BackendProtocol \| Factory` | `StateBackend` | 后端存储 |
| `checkpointer` | `BaseCheckpointSaver \| boolean` | - | 状态持久化 |
| `store` | `BaseStore` | - | 长期记忆存储 |
| `skills` | `string[]` | - | 技能目录路径 |
| `memory` | `string[]` | - | 记忆文件路径 |
| `name` | `string` | - | Agent 名称 |
| `interruptOn` | `Record<string, boolean \| InterruptOnConfig>` | - | HITL 中断配置 |

## 附录 B：中间件执行顺序

```
1. todoListMiddleware          # 任务管理
2. skillsMiddleware            # 技能加载 (可选)
3. filesystemMiddleware        # 文件操作
4. subAgentMiddleware          # 子代理委派
5. summarizationMiddleware     # 对话摘要
6. patchToolCallsMiddleware    # 工具调用修复
7. asyncSubAgentMiddleware     # 异步子代理 (可选)
8. [自定义中间件]               # 用户扩展
9. cacheMiddleware             # Anthropic 缓存 (自动)
10. memoryMiddleware           # 长期记忆 (可选)
11. humanInTheLoopMiddleware   # 人工审核 (可选)
```

# 多 Agent 智能体平台 — 技术实现方案

## 1. 方案目标

基于 `deepagentsjs` 核心库，构建一个完整的多 Agent 智能体平台，包含：

1. **Hono 后端服务**：统一的 Agent 注册、路由与 SSE 流式 API
2. **Vue 3 前端 Chat 页面**：实时展示 Agent 全链路执行过程（思考 → 工具调用 → 子代理委派 → 最终回答）
3. **多 Agent 配置系统**：参照 OpenClaw 模式，通过声明式配置文件定义多个独立 Agent
4. **独立工作空间隔离**：每个 Agent 拥有独立的文件系统、技能、记忆和会话状态
5. **PostgreSQL 会话持久化**：使用 `@langchain/langgraph-checkpoint-postgres` 将多轮对话状态持久化到 PostgreSQL 数据库
6. **Agent 热重载**：监听 `agents.yaml` 配置变更，自动重新加载 Agent 定义，无需重启服务
7. **OpenClaw 兼容**：可直接读取 OpenClaw 的 `openclaw.json` 配置和工作空间文件，详见 [OpenClaw 兼容设计](openclaw-compatibility.md)

---

## 2. 整体架构

```
┌──────────────────────────────────────────────────────────────────┐
│                          Vue 3 前端                              │
│  ┌──────────┐  ┌────────────────┐  ┌──────────────────────────┐  │
│  │ AgentList │  │  ChatView      │  │  ChainViewer             │  │
│  │ 侧边栏    │  │  消息流 + 输入  │  │  链路追踪面板 (可折叠)    │  │
│  └─────┬────┘  └───────┬────────┘  └────────────┬─────────────┘  │
│        │               │                        │                │
│        └───────────────┼────────────────────────┘                │
│                        │ SSE EventSource                         │
└────────────────────────┼─────────────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────────────┐
│                     Hono HTTP 服务层                              │
│  ┌───────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ GET /agents   │  │ POST /chat   │  │ POST /stream           │ │
│  │ 列出所有Agent  │  │ 同步调用     │  │ SSE 流式调用            │ │
│  └───────┬───────┘  └──────┬───────┘  └──────────┬─────────────┘ │
│          │                 │                     │               │
│  ┌───────▼─────────────────▼─────────────────────▼─────────────┐ │
│  │             AgentRegistry (注册中心 + 热重载)                 │ │
│  │  agents.yaml → 解析 → Map<agentId, AgentInstance>            │ │
│  │  chokidar.watch → 自动重载配置                                │ │
│  └──────────┬───────────────────────────────────┬──────────────┘ │
│             │                                   │               │
│  ┌──────────▼──────────────────────────────────┐│               │
│  │           Agent 实例 (createDeepAgent)       ││               │
│  │  ┌─────────────┐ ┌───────────┐ ┌──────────┐ ││               │
│  │  │ Agent A     │ │ Agent B   │ │ Agent C  │ ││               │
│  │  │ workspace/a │ │ w.space/b │ │ w.spa/c  │ ││               │
│  │  └─────────────┘ └───────────┘ └──────────┘ ││               │
│  └──────────┬──────────────────────────────────┘│               │
│             │                                   │               │
│  ┌──────────▼───────────────────────────────────▼──────────────┐ │
│  │             PostgreSQL (agentdb)                             │ │
│  │  PostgresSaver Checkpointer → 多轮对话状态持久化              │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. 后端服务设计

### 3.1 统一 Agent 配置文件 (`agents.yaml`)

参照 OpenClaw 的声明式配置模式，在项目根目录使用 `agents.yaml` 定义所有 Agent：

```yaml
# agents.yaml — 多 Agent 声明式配置

# 全局默认值
defaults:
  model: "dashscope"           # 使用 DashScope deepseek-v3（通过 .env 配置）
  recursionLimit: 1000
  workspace: "./workspaces"   # 工作空间根目录
  skills: []                  # 全局共享技能
  memory: []                  # 全局共享记忆

# Agent 列表
agents:
  - id: "research-assistant"
    name: "调研助手"
    description: "专业的深度调研与报告生成助手"
    icon: "🔍"
    # model 不填则继承 defaults.model
    systemPrompt: |
      你是一个专业的调研助手，能够深度搜索互联网信息并整理为结构化报告。
    tools:
      - "internet_search"
      - "web_scraper"
    skills:
      - "/skills/web-research/"
    subagents:
      - name: "researcher"
        description: "深度搜索特定主题"
        systemPrompt: "你是一个专注的调研员..."
        tools: ["internet_search"]
      - name: "critic"
        description: "审查报告质量"
        systemPrompt: "你是一个严格的编辑..."

  - id: "code-assistant"
    name: "编程助手"
    description: "全栈代码编写、审查与调试助手"
    icon: "💻"
    systemPrompt: |
      你是一个高级全栈工程师，擅长编写高质量代码并进行代码审查。
    tools:
      - "code_executor"
    skills:
      - "/skills/coding/"
    subagents:
      - name: "coder"
        description: "编写和修改代码"
        tools: ["code_executor"]
      - name: "reviewer"
        description: "代码审查和优化建议"

  - id: "general-assistant"
    name: "通用助手"
    description: "通用对话与任务处理助手"
    icon: "🤖"
    systemPrompt: |
      你是一个通用的 AI 助手，可以回答问题并协助完成各类日常任务。
```

### 3.2 Agent 注册中心 (`AgentRegistry`)

核心类，负责解析配置、创建 Agent 实例、管理工作空间隔离：

```typescript
// src/registry/agent-registry.ts

import { createDeepAgent, FilesystemBackend } from "deepagents";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { ChatOpenAI } from "@langchain/openai";
import { parse } from "yaml";
import { watch } from "chokidar";
import fs from "node:fs";
import path from "node:path";

interface AgentConfig {
  id: string;
  name: string;
  description: string;
  icon?: string;
  model?: string;
  systemPrompt: string;
  tools?: string[];
  skills?: string[];
  memory?: string[];
  subagents?: SubAgentConfig[];
}

interface AgentEntry {
  config: AgentConfig;
  workspaceDir: string;   // 独立工作空间路径
  skillsDir: string;      // 独立技能目录
}

export class AgentRegistry {
  private agents = new Map<string, AgentEntry>();
  private workspaceRoot: string;
  private configPath: string;
  private checkpointer: PostgresSaver | null = null;
  private watcher: any = null;

  constructor(configPath: string) {
    this.configPath = configPath;
    this.loadConfig();
  }

  /** 加载/重新加载配置文件 */
  private loadConfig() {
    const raw = fs.readFileSync(this.configPath, "utf-8");
    const config = parse(raw);
    this.workspaceRoot = path.resolve(config.defaults?.workspace || "./workspaces");

    const newAgents = new Map<string, AgentEntry>();
    for (const agentCfg of config.agents) {
      const workspaceDir = path.join(this.workspaceRoot, agentCfg.id);
      const skillsDir = path.join(workspaceDir, "skills");

      // 确保工作空间目录存在
      fs.mkdirSync(workspaceDir, { recursive: true });
      fs.mkdirSync(skillsDir, { recursive: true });

      newAgents.set(agentCfg.id, {
        config: { ...config.defaults, ...agentCfg },
        workspaceDir,
        skillsDir,
      });
    }

    this.agents = newAgents;
    console.log(`[INFO] [AgentRegistry] 已加载 ${newAgents.size} 个 Agent 配置`);
  }

  /** 初始化 PostgreSQL Checkpointer（服务启动时调用一次） */
  async initCheckpointer() {
    const connString = process.env.PG_CONNECTION_STRING
      || "postgresql://postgres:postgres@localhost:5432/agentdb";

    this.checkpointer = PostgresSaver.fromConnString(connString);
    await this.checkpointer.setup(); // 首次自动创建所需表
    console.log(`[INFO] [AgentRegistry] PostgreSQL Checkpointer 初始化完成`);
  }

  /** 启动 agents.yaml 热重载监听 */
  enableHotReload() {
    this.watcher = watch(this.configPath, { ignoreInitial: true });
    this.watcher.on("change", () => {
      console.log(`[INFO] [AgentRegistry] 检测到 agents.yaml 变更，正在热重载...`);
      try {
        this.loadConfig();
        console.log(`[INFO] [AgentRegistry] 热重载完成`);
      } catch (err) {
        console.error(`[ERROR] [AgentRegistry] 热重载失败:`, err);
      }
    });
    console.log(`[INFO] [AgentRegistry] 热重载已启用，监听 ${this.configPath}`);
  }

  /** 停止热重载监听 */
  async disableHotReload() {
    await this.watcher?.close();
    this.watcher = null;
  }

  /** 列出所有注册的 Agent */
  listAgents() {
    return Array.from(this.agents.values()).map(({ config }) => ({
      id: config.id,
      name: config.name,
      description: config.description,
      icon: config.icon,
    }));
  }

  /** 解析模型配置 — 根据 model 字段返回对应的 LLM 实例 */
  private resolveModel(modelName?: string) {
    const name = modelName || "dashscope";

    // DashScope（deepseek-v3, qwen 等）通过 OpenAI 兼容接口调用
    if (name === "dashscope" || name.startsWith("dashscope:")) {
      return new ChatOpenAI({
        modelName: process.env.DASHSCOPE_MODEL || "deepseek-v3",
        temperature: Number(process.env.LLM_TEMPERATURE) || 0.7,
        configuration: {
          baseURL: process.env.DASHSCOPE_BASE_URL
            || "https://dashscope.aliyuncs.com/compatible-mode/v1",
          apiKey: process.env.DASHSCOPE_API_KEY,
        },
        timeout: Number(process.env.REQUEST_TIMEOUT) || 60000,
      });
    }

    // 其他模型直接以字符串形式传入 deepagents
    return name;
  }

  /** 根据 ID 创建 Agent 实例 */
  createAgent(agentId: string) {
    const entry = this.agents.get(agentId);
    if (!entry) throw new Error(`Agent "${agentId}" 未注册`);

    const { config, workspaceDir } = entry;

    return createDeepAgent({
      model: this.resolveModel(config.model),
      systemPrompt: config.systemPrompt,
      tools: this.resolveTools(config.tools || []),
      subagents: this.resolveSubAgents(config.subagents || []),
      skills: config.skills,
      memory: config.memory,
      backend: new FilesystemBackend({ rootDir: workspaceDir }),
      checkpointer: this.checkpointer || undefined,
      name: config.id,
    });
  }

  // ... resolveTools / resolveSubAgents 实现
}
```

### 3.3 Hono 路由设计

```typescript
// src/routes/agents.ts — Agent 管理与调用路由

const agentsRoute = new Hono();

// GET /api/agents — 列出所有可用 Agent
agentsRoute.get("/", (c) => {
  return c.json(registry.listAgents());
});

// GET /api/agents/:id — 获取单个 Agent 详情
agentsRoute.get("/:id", (c) => {
  const info = registry.getAgent(c.req.param("id"));
  return c.json(info);
});

// POST /api/agents/:id/invoke — 同步调用
agentsRoute.post("/:id/invoke", async (c) => {
  const agentId = c.req.param("id");
  const { messages, threadId } = await c.req.json();
  const agent = registry.createAgent(agentId);
  const result = await agent.invoke(
    { messages },
    { configurable: { thread_id: threadId } }
  );
  return c.json(result);
});

// POST /api/agents/:id/stream — SSE 流式调用
agentsRoute.post("/:id/stream", async (c) => {
  const agentId = c.req.param("id");
  const { messages, threadId } = await c.req.json();
  const agent = registry.createAgent(agentId);

  return streamSSE(c, async (stream) => {
    const agentStream = await agent.stream(
      { messages },
      {
        streamMode: "updates",
        subgraphs: true,
        configurable: { thread_id: threadId },
      }
    );

    for await (const [namespace, chunk] of agentStream) {
      // 解析链路事件类型
      for (const [nodeName, data] of Object.entries(chunk)) {
        const event = classifyEvent(namespace, nodeName, data);
        await stream.writeSSE({
          event: event.type,
          data: JSON.stringify(event),
        });
      }
    }
    await stream.writeSSE({ event: "done", data: "[DONE]" });
  });
});
```

### 3.4 SSE 事件协议定义

前后端之间的 SSE 事件采用统一的协议格式，分为以下类型：

```typescript
// src/types/sse-events.ts

/** SSE 事件类型 */
type SSEEventType =
  | "thinking"           // Agent 正在思考/生成文本
  | "tool_call"          // Agent 发起工具调用
  | "tool_result"        // 工具返回结果
  | "subagent_start"     // 子代理开始执行
  | "subagent_thinking"  // 子代理思考过程
  | "subagent_complete"  // 子代理执行完成
  | "todo_update"        // 任务列表变更
  | "file_update"        // 文件系统变更
  | "error"              // 错误
  | "done";              // 完成

interface SSEEvent {
  type: SSEEventType;
  timestamp: string;
  source: string;            // "main" 或子代理名称
  node: string;              // LangGraph 节点名
  data: {
    content?: string;         // 文本内容
    toolName?: string;        // 工具名称
    toolArgs?: unknown;       // 工具参数
    toolResult?: unknown;     // 工具结果
    subagentName?: string;    // 子代理名称
    status?: string;          // pending / running / complete
    todos?: TodoItem[];       // 任务列表
    files?: Record<string, unknown>; // 文件变更
  };
}
```

### 3.5 事件分类逻辑

基于 deepagentsjs 的流式输出特征（参考 `examples/streaming/lifecycle.ts`），需要从 LangGraph 的 `[namespace, chunk]` 数据中分类出可读事件：

```typescript
// src/utils/event-classifier.ts

function classifyEvent(
  namespace: string[],
  nodeName: string,
  data: any
): SSEEvent {
  const isMainAgent = namespace.length === 0;
  const isSubagent = namespace.length > 0;
  const source = isMainAgent ? "main" : namespace.join("|");

  // 主 Agent 的模型回复 → thinking
  if (isMainAgent && nodeName === "model_request") {
    const messages = data.messages || [];
    for (const msg of messages) {
      // 检测 tool_call → 可能是子代理启动
      if (msg.tool_calls?.length > 0) {
        for (const tc of msg.tool_calls) {
          if (tc.name === "task") {
            return {
              type: "subagent_start",
              source,
              node: nodeName,
              data: {
                subagentName: tc.args?.subagent_type,
                content: tc.args?.description,
                status: "pending",
              },
            };
          }
          return {
            type: "tool_call",
            source,
            node: nodeName,
            data: {
              toolName: tc.name,
              toolArgs: tc.args,
            },
          };
        }
      }
      // 普通文本回复
      if (msg.content) {
        return {
          type: "thinking",
          source,
          node: nodeName,
          data: { content: msg.content },
        };
      }
    }
  }

  // 工具结果返回
  if (isMainAgent && nodeName === "tools") {
    return {
      type: "tool_result",
      source,
      node: nodeName,
      data: { toolResult: data },
    };
  }

  // 子代理事件
  if (isSubagent) {
    return {
      type: "subagent_thinking",
      source,
      node: nodeName,
      data: { content: JSON.stringify(data) },
    };
  }

  return { type: "thinking", source, node: nodeName, data };
}
```

---

## 4. 前端设计（Vue 3）

### 4.1 技术选型

| 项目 | 选择 | 说明 |
|------|------|------|
| 框架 | Vue 3 + TypeScript | Composition API |
| 构建 | Vite | 开发服务器 + 构建 |
| 样式 | 原生 CSS + CSS Variables | 暗色主题 + 现代设计 |
| 状态管理 | Pinia | 轻量级 |
| SSE 通信 | EventSource / fetch + ReadableStream | 流式数据 |
| 图标 | lucide-vue-next | 轻量 SVG 图标 |

### 4.2 目录结构

```
src-frontend/
├── src/
│   ├── App.vue
│   ├── main.ts
│   ├── api/
│   │   ├── agents.ts           # Agent 列表 API
│   │   └── stream.ts           # SSE 流式通信
│   ├── stores/
│   │   ├── agents.ts           # Agent 列表状态
│   │   └── chat.ts             # 聊天状态 (消息 + 链路)
│   ├── components/
│   │   ├── AgentSidebar.vue    # 左侧 Agent 列表
│   │   ├── ChatView.vue        # 中央聊天区域
│   │   ├── MessageBubble.vue   # 消息气泡
│   │   ├── ChainPanel.vue      # 右侧链路追踪面板
│   │   ├── ChainStep.vue       # 链路步骤组件
│   │   ├── ToolCallCard.vue    # 工具调用展示卡片
│   │   └── InputBar.vue        # 底部输入栏
│   ├── composables/
│   │   ├── useSSE.ts           # SSE 连接管理
│   │   └── useChainTracker.ts  # 链路事件追踪
│   └── styles/
│       ├── variables.css       # CSS 变量定义
│       ├── global.css          # 全局样式
│       └── chat.css            # 聊天专用样式
```

### 4.3 核心组件设计

#### 4.3.1 `AgentSidebar.vue` — Agent 选择侧边栏

```
┌──────────────────┐
│ 🤖 Agent 列表     │
│──────────────────│
│ 🔍 调研助手  ← 选中 │
│ 💻 编程助手        │
│ 🤖 通用助手        │
│                  │
│ ──── 会话 ────── │
│ • 上次的调研任务   │
│ • 量子计算报告     │
│ • ...             │
└──────────────────┘
```

- 展示所有注册的 Agent 列表（来自 `GET /api/agents`）
- 支持切换当前激活的 Agent
- 展示历史会话列表

#### 4.3.2 `ChatView.vue` — 核心聊天区域

```
┌──────────────────────────────────────────────┐
│ 🔍 调研助手                                   │
│──────────────────────────────────────────────│
│                                              │
│  [用户] 帮我调研量子计算最新进展                 │
│                                              │
│  [Agent] (思考中 ····)                        │
│  ┌ 📋 制定调研计划                             │
│  │  ☑ 搜索量子网络进展                         │
│  │  ☐ 搜索量子纠错进展                         │
│  │  ☐ 整理最终报告                            │
│  └────────────────────                       │
│                                              │
│  ┌ 🔧 调用工具: internet_search               │
│  │  query: "quantum computing 2026 advances" │
│  │  ✅ 返回 5 条结果                           │
│  └────────────────────                       │
│                                              │
│  ┌ 🤖 委派子代理: researcher                   │
│  │  状态: 执行中 ···                           │
│  │  "正在搜索量子纠错最新论文..."                │
│  └────────────────────                       │
│                                              │
│  [Agent] 以下是量子计算最新进展的调研报告...      │
│                                              │
│──────────────────────────────────────────────│
│ [输入框: 请输入消息...]            [发送]       │
└──────────────────────────────────────────────┘
```

关键设计要点：
- **消息流内嵌链路卡片**：工具调用、子代理状态等以折叠卡片的形式内嵌在消息流中
- **实时更新**：通过 SSE 事件驱动界面数据更新
- **Markdown 渲染**：Agent 最终回复使用 Markdown 渲染
- **代码高亮**：代码块使用语法高亮

#### 4.3.3 `ChainPanel.vue` — 右侧链路追踪面板

可选显示的详细链路追踪面板，以时间线形式展示 Agent 执行全过程：

```
┌──────────────────────────┐
│ 📊 执行链路               │
│──────────────────────────│
│ ⏱ 总耗时: 12.3s          │
│ 📝 步骤: 8/8 完成         │
│                          │
│ ● 17:30:01 model_request │
│   思考 → 制定调研计划      │
│                          │
│ ● 17:30:02 write_todos   │
│   创建 3 项任务           │
│                          │
│ ● 17:30:03 task          │
│   → 委派: researcher      │
│   状态: ✅ 完成            │
│   耗时: 5.2s             │
│                          │
│ ● 17:30:08 write_file    │
│   → final_report.md      │
│                          │
│ ● 17:30:10 model_request │
│   生成最终回复            │
└──────────────────────────┘
```

### 4.4 SSE 通信层 (`useSSE.ts`)

```typescript
// src/composables/useSSE.ts

import { ref, onUnmounted } from "vue";
import type { SSEEvent } from "@/types";

export function useSSE(agentId: string) {
  const events = ref<SSEEvent[]>([]);
  const isStreaming = ref(false);
  const error = ref<string | null>(null);
  let controller: AbortController | null = null;

  async function sendMessage(messages: any[], threadId: string) {
    isStreaming.value = true;
    error.value = null;
    controller = new AbortController();

    try {
      const response = await fetch(`/api/agents/${agentId}/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, threadId }),
        signal: controller.signal,
      });

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              isStreaming.value = false;
              return;
            }
            try {
              const event: SSEEvent = JSON.parse(data);
              events.value.push(event);
            } catch {}
          }
        }
      }
    } catch (e: any) {
      if (e.name !== "AbortError") {
        error.value = e.message;
      }
    } finally {
      isStreaming.value = false;
    }
  }

  function abort() {
    controller?.abort();
  }

  onUnmounted(() => abort());

  return { events, isStreaming, error, sendMessage, abort };
}
```

---

## 5. 工作空间隔离机制

参照 OpenClaw 的隔离设计，每个 Agent 拥有完全独立的运行环境：

```
workspaces/
├── research-assistant/         # 调研助手工作空间
│   ├── files/                  # Agent 文件系统
│   │   ├── question.txt
│   │   └── final_report.md
│   ├── skills/                 # Agent 专属技能
│   │   └── web-research/
│   │       └── SKILL.md
│   ├── memory/                 # Agent 长期记忆
│   │   └── AGENTS.md
│   └── sessions/               # 会话历史（可选）
│
├── code-assistant/             # 编程助手工作空间
│   ├── files/
│   ├── skills/
│   │   └── coding/
│   │       └── SKILL.md
│   ├── memory/
│   └── sessions/
│
└── general-assistant/          # 通用助手工作空间
    ├── files/
    ├── skills/
    ├── memory/
    └── sessions/
```

### 隔离保障

| 维度 | 隔离方式 |
|------|---------|
| **文件系统** | 每个 Agent 使用独立的 `FilesystemBackend({ rootDir })` |
| **技能** | 每个 Agent 配置独立的 `skills` 路径 |
| **记忆** | 每个 Agent 使用独立的 `memory` 路径 |
| **会话** | 通过 `thread_id` 前缀 `{agentId}:{sessionId}` 隔离 |
| **状态** | Checkpointer 的 namespace 按 Agent ID 分区 |

---

## 6. 新增目录结构规划

在项目中新增以下目录：

```
deepagentsjs/
├── services/                       # [NEW] 服务总目录
│   └── agent-platform/             # [NEW] 多 Agent 平台服务
│       ├── src/
│       │   ├── index.ts            # Hono 服务入口
│       │   ├── registry/
│       │   │   └── agent-registry.ts  # 含 PG Checkpointer + 热重载
│       │   ├── routes/
│       │   │   ├── agents.ts
│       │   │   ├── stream.ts
│       │   │   └── sessions.ts     # [NEW] 会话管理路由
│       │   ├── tools/              # 共享工具定义
│       │   │   └── index.ts
│       │   └── utils/
│       │       └── event-classifier.ts
│       ├── agents.yaml             # Agent 声明配置
│       ├── package.json
│       └── tsconfig.json
│
├── src-frontend/                   # [NEW] Vue3 前端
│   ├── src/
│   │   ├── App.vue
│   │   ├── main.ts
│   │   ├── api/
│   │   ├── stores/
│   │   ├── components/
│   │   ├── composables/
│   │   └── styles/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── workspaces/                     # [NEW] Agent 工作空间 (gitignore)
│   ├── research-assistant/
│   ├── code-assistant/
│   └── general-assistant/
│
└── agents.yaml                     # [NEW] 根目录 Agent 配置
```

---

## 7. 启动与开发命令

### 7.1 package.json Scripts

```json
{
  "scripts": {
    "dev": "concurrently \"bun run dev:service\" \"bun run dev:frontend\"",
    "dev:frontend": "cd src-frontend && bun run dev",
    "dev:service": "cd services/agent-platform && bun run --watch src/index.ts",
    "build": "cd src-frontend && bun run build"
  }
}
```

### 7.2 环境变量配置 (`.env`)

```bash
# ============================================
# PostgreSQL 数据库配置
# ============================================
PG_CONNECTION_STRING=postgresql://postgres:postgres@localhost:5432/agentdb

# ============================================
# DashScope API 配置 (OpenAI 兼容模式)
# ============================================
DASHSCOPE_API_KEY=sk-6fc5d27d01594140ba02ecf47b89226a
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DASHSCOPE_MODEL=deepseek-v3
LLM_TEMPERATURE=0.7
REQUEST_TIMEOUT=60000

# ============================================
# Embedding & Reranker 模型配置
# ============================================
EMBEDDING_PROVIDER=ollama
EMBEDDING_MODEL=bge-m3
OLLAMA_BASE_URL=http://localhost:11434

# ============================================
# 服务端口
# ============================================
PORT=3000
```

### 7.3 启动流程

```bash
# 1. 安装所有依赖
bun install

# 2. 确保 PostgreSQL 已启动且 agentdb 数据库已创建
# CREATE DATABASE agentdb;

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env，确认 PG 连接串和 DashScope API Key

# 4. 编辑 agents.yaml，定义你的 Agent

# 5. 启动开发环境
bun run dev
# 前端: http://localhost:5173
# 后端: http://localhost:3000
# 数据库: postgresql://localhost:5432/agentdb
```

---

## 8. 关键技术要点

### 8.1 流式链路追踪的 SSE 事件分发

deepagentsjs 的 `agent.stream()` 以 `[namespace, chunk]` 对形式输出，其中：
- `namespace = []` → 主 Agent 事件
- `namespace = ["tools:UUID"]` → 子代理执行事件  
- `chunk` 的 key 是 LangGraph 节点名（`model_request`, `tools` 等）

事件分发流程：

```
agent.stream() → [namespace, chunk]
    ↓
classifyEvent(namespace, nodeName, data) → SSEEvent
    ↓
stream.writeSSE({ event: type, data: JSON.stringify(event) })
    ↓
前端 EventSource → useSSE composable → 更新 Pinia store → 驱动 UI 更新
```

### 8.2 前端消息与链路条目的合并展示

前端将 SSE 事件按时间顺序追加到一个统一列表中，UI 根据事件类型渲染不同的组件：

| 事件类型 | 渲染组件 | 展示形式 |
|---------|---------|---------|
| `thinking` | `MessageBubble` | Markdown 文本气泡 |
| `tool_call` | `ToolCallCard` | 折叠面板：工具名 + 参数 |
| `tool_result` | `ToolCallCard` | 面板展开：结果预览 |
| `subagent_start` | `ChainStep` | 子代理启动卡片 (⏳ pending) |
| `subagent_thinking` | `ChainStep` | 子代理思考流（实时文本） |
| `subagent_complete` | `ChainStep` | 子代理完成 (✅ complete) |
| `todo_update` | `TodoList` | 内嵌任务清单 |
| `file_update` | `FileCard` | 文件操作提示 |

### 8.3 防止 Agent 间状态污染

每次 API 调用时，通过 `registry.createAgent(agentId)` 创建新的 Agent 实例，确保：
- 跨请求/跨 Agent 之间无状态共享
- `FilesystemBackend` 的 `rootDir` 限定文件操作范围
- `thread_id` 带有 Agent ID 前缀，避免 checkpointer 中会话串扰

---

## 9. PostgreSQL 会话持久化

### 9.1 Checkpointer 原理

`@langchain/langgraph-checkpoint-postgres` 会在 PostgreSQL 中创建专用表，存储 LangGraph 的执行快照。每个 `thread_id` 对应一个独立的对话线程，Agent 可以跨请求恢复完整的对话上下文。

### 9.2 数据库准备

```sql
-- 创建数据库（用户提供的本地 PG 实例）
CREATE DATABASE agentdb;
-- 连接信息: postgresql://postgres:postgres@localhost:5432/agentdb
-- PostgresSaver.setup() 会自动创建所需的 checkpoint 表
```

### 9.3 Checkpointer 初始化（服务入口）

```typescript
// src/index.ts — 服务启动时初始化 Checkpointer
import "dotenv/config";
import { Hono } from "hono";
import { AgentRegistry } from "./registry/agent-registry";

const registry = new AgentRegistry("./agents.yaml");

// 异步初始化
await registry.initCheckpointer();  // 连接 PG + 建表
registry.enableHotReload();          // 开启配置热重载

const app = new Hono();
// ... 路由挂载 ...

export default { port: Number(process.env.PORT) || 3000, fetch: app.fetch };
```

### 9.4 Checkpointer 在 Agent 中的作用

启用 Checkpointer 后，所有通过 `thread_id` 发起的对话将自动持久化：

```typescript
// 第一次对话
const result1 = await agent.invoke(
  { messages: [{ role: "user", content: "帮我调研量子计算" }] },
  { configurable: { thread_id: "research-assistant:session-001" } }
);

// 后续对话 — 自动恢复完整上下文
const result2 = await agent.invoke(
  { messages: [{ role: "user", content: "继续深入分析量子纠错部分" }] },
  { configurable: { thread_id: "research-assistant:session-001" } }
);
// result2 拥有 result1 的完整对话历史和 Agent 状态
```

### 9.5 会话管理 API

```typescript
// src/routes/sessions.ts
const sessionsRoute = new Hono();

// GET /api/agents/:id/sessions — 列出某 Agent 的所有会话
sessionsRoute.get("/:agentId/sessions", async (c) => {
  const agentId = c.req.param("agentId");
  // 从 PG 查询该 Agent 的所有 thread_id
  const sessions = await registry.listSessions(agentId);
  return c.json(sessions);
});

// GET /api/agents/:id/sessions/:threadId — 获取会话历史
sessionsRoute.get("/:agentId/sessions/:threadId", async (c) => {
  const { agentId, threadId } = c.req.param();
  const history = await registry.getSessionHistory(agentId, threadId);
  return c.json(history);
});

// DELETE /api/agents/:id/sessions/:threadId — 删除会话
sessionsRoute.delete("/:agentId/sessions/:threadId", async (c) => {
  const { agentId, threadId } = c.req.param();
  await registry.deleteSession(agentId, threadId);
  return c.json({ success: true });
});
```

---

## 10. Agent 热重载机制

### 10.1 原理

使用 `chokidar` 文件监听库监听 `agents.yaml` 的变更事件。当检测到文件修改后，自动重新解析配置并刷新 `AgentRegistry` 内部的 Agent 映射表。所有后续请求将使用新配置创建 Agent 实例。

### 10.2 热重载流程

```
agents.yaml 被修改
    ↓
chokidar 触发 "change" 事件
    ↓
AgentRegistry.loadConfig() 重新解析 YAML
    ↓
更新内部 Map<agentId, AgentEntry>
    ↓
新建工作空间目录（如有新 Agent）
    ↓
下一次 API 请求将使用新配置
```

### 10.3 热重载安全保障

| 场景 | 处理方式 |
|------|----------|
| 配置文件语法错误 | catch 异常，保留上一次的有效配置，记录 ERROR 日志 |
| 删除了正在使用的 Agent | 已有的活跃连接不受影响，新请求返回 404 |
| 新增 Agent | 自动创建工作空间目录，立即可用 |
| 修改 Agent 配置 | 下一次 `createAgent()` 调用将使用新配置 |
| 短时间内多次修改 | chokidar 自带 debounce，避免频繁重载 |

### 10.4 运行时日志示例

```
[INFO] [AgentRegistry] 已加载 3 个 Agent 配置
[INFO] [AgentRegistry] PostgreSQL Checkpointer 初始化完成
[INFO] [AgentRegistry] 热重载已启用，监听 ./agents.yaml
...
# 用户修改了 agents.yaml
[INFO] [AgentRegistry] 检测到 agents.yaml 变更，正在热重载...
[INFO] [AgentRegistry] 已加载 4 个 Agent 配置
[INFO] [AgentRegistry] 热重载完成
```

---

## 11. 模型配置说明

### 11.1 DashScope (deepseek-v3) — 主力 LLM

通过 OpenAI 兼容接口（`@langchain/openai` 的 `ChatOpenAI`）调用阿里云 DashScope 服务：

| 配置项 | 值 | 说明 |
|--------|-----|------|
| `DASHSCOPE_BASE_URL` | `https://dashscope.aliyuncs.com/compatible-mode/v1` | OpenAI 兼容端点 |
| `DASHSCOPE_MODEL` | `deepseek-v3` | 可选: `qwen-vl-plus` 等 |
| `LLM_TEMPERATURE` | `0.7` | 生成随机性 |
| `REQUEST_TIMEOUT` | `60000` | 请求超时 (ms) |

### 11.2 Ollama (bge-m3) — Embedding 模型

本地部署的 Embedding 模型，用于后续的知识检索/向量化扩展：

| 配置项 | 值 | 说明 |
|--------|-----|------|
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama 服务地址 |
| `EMBEDDING_MODEL` | `bge-m3` | 多语言 Embedding 模型 |

### 11.3 在 `agents.yaml` 中覆盖模型

不同 Agent 可以使用不同的模型，在 `agents.yaml` 中直接指定：

```yaml
agents:
  - id: "research-assistant"
    model: "dashscope"         # 使用默认 DashScope
    # ...
  
  - id: "code-assistant"
    model: "dashscope:qwen-vl-plus"  # 使用 qwen-vl-plus
    # ...
```

---

## 12. 依赖安装清单

```bash
# 后端服务依赖
bun add hono deepagents @langchain/openai @langchain/langgraph-checkpoint-postgres pg yaml chokidar zod dotenv

# 开发依赖
bun add -d typescript @types/node @types/pg

# 前端依赖
cd src-frontend
bun add vue vue-router pinia
bun add -d vite @vitejs/plugin-vue typescript
```

---

## 13. 后续扩展点

| 功能 | 说明 |
|------|------|
| **权限控制** | 在 Hono 中间件层添加 JWT/API Key 验证 |
| **WebSocket 替代 SSE** | 需要双向通信时升级为 WebSocket |
| **LangSmith 集成** | 自动上报所有 Agent 链路到 LangSmith 平台 |
| **Agent 市场** | 允许用户上传/分享 Agent 配置和技能包 |
| **沙盒执行** | 为代码类 Agent 集成 Deno/QuickJS 沙盒后端 |
| **向量检索** | 集成 Ollama bge-m3 Embedding + pgvector 实现 RAG |

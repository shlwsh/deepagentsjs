# OpenClaw 兼容设计 — 多智能体服务补充方案

本文档基于对实际 OpenClaw 配置（`~/.openclaw/openclaw.json`）和工作空间（`workspace/`, `workspace-doctor/`）的深度分析，详述如何让当前多 Agent 平台与 OpenClaw 配置完全兼容。

---

## 1. OpenClaw 配置结构解析

### 1.1 `openclaw.json` 核心结构

```
openclaw.json
├── meta                        # 元信息（版本、时间戳）
├── models                      # 模型提供商注册表
│   ├── mode: "merge"
│   └── providers
│       ├── vllm                # DashScope (OpenAI 兼容)
│       │   ├── baseUrl
│       │   ├── apiKey
│       │   └── models[]        # id, name, reasoning, contextWindow, maxTokens
│       └── ollama              # 本地 Ollama
│           ├── baseUrl
│           ├── apiKey
│           └── models[]
├── agents                      # Agent 定义
│   ├── defaults                # 全局默认值
│   │   ├── model.primary       # "vllm/deepseek-v3"
│   │   ├── workspace           # 默认工作空间路径
│   │   ├── memorySearch        # 记忆搜索配置
│   │   ├── compaction          # 对话压缩模式
│   │   ├── maxConcurrent       # 最大并发数
│   │   └── subagents.maxConcurrent
│   └── list[]                  # Agent 列表
│       ├── id                  # Agent 唯一标识
│       ├── name                # 显示名称（可选）
│       ├── workspace           # 独立工作空间路径（可选，覆盖 defaults）
│       ├── agentDir            # Agent 运行时目录（会话/认证等）
│       └── skills[]            # 技能名称列表
├── tools                       # 全局工具配置（web search/fetch 等）
├── bindings[]                  # 路由绑定规则
│   ├── type: "route"
│   ├── agentId                 # 目标 Agent
│   └── match                   # 匹配条件 (channel, accountId)
├── session                     # 会话作用域配置
├── channels                    # 通道配置（feishu/discord 等）
└── plugins                     # 插件注册与安装
```

### 1.2 工作空间（Workspace）文件约定

每个 Agent 的 workspace 目录下包含以下标准 Markdown 配置文件：

| 文件 | 用途 | 是否必须 |
| ---- | ---- | -------- |
| `SOUL.md` | Agent 人格定义（核心价值观、行为边界、沟通风格） | ✅ |
| `AGENTS.md` | 工作规范（启动流程、记忆管理、安全红线、工具使用、心跳协议） | ✅ |
| `USER.md` | 用户画像（姓名、时区、偏好，由 Agent 逐步填充） | ✅ |
| `IDENTITY.md` | Agent 身份卡（名字、生物类型、情绪基调、签名 emoji） | ✅ |
| `TOOLS.md` | 本地工具备忘录（环境特有的设备名、SSH 配置等） | 可选 |
| `BOOTSTRAP.md` | 首次运行引导脚本（完成后由 Agent 自行删除） | 仅首次 |
| `HEARTBEAT.md` | 心跳任务清单（周期性检查项） | 可选 |
| `memory/` | 日记式记忆目录（`YYYY-MM-DD.md` + `MEMORY.md`） | 自动创建 |
| `skills/` | Agent 可用技能目录（每个技能一个子目录 + `SKILL.md`） | 可选 |

### 1.3 Agent 运行时目录（agentDir）

```
agents/{agentId}/agent/
├── sessions/          # 会话状态持久化
└── auth-profiles.json # 认证凭据（不可共享）
```

---

## 2. 兼容性设计方案

### 2.1 配置文件兼容

我们的平台直接读取 `openclaw.json`，而不是另建 `agents.yaml`。解析逻辑如下：

```typescript
// src/registry/openclaw-config-parser.ts

import fs from "node:fs";
import { ChatOpenAI } from "@langchain/openai";

interface OpenClawConfig {
  models: {
    providers: Record<string, {
      baseUrl: string;
      apiKey: string;
      api: string;
      models: Array<{
        id: string;
        name: string;
        reasoning: boolean;
        contextWindow: number;
        maxTokens: number;
      }>;
    }>;
  };
  agents: {
    defaults: {
      model: { primary: string };
      workspace: string;
      maxConcurrent: number;
      subagents: { maxConcurrent: number };
    };
    list: Array<{
      id: string;
      name?: string;
      workspace?: string;
      agentDir?: string;
      skills?: string[];
    }>;
  };
  tools: Record<string, any>;
  bindings: Array<{
    type: string;
    agentId: string;
    match: Record<string, string>;
  }>;
}

export function parseOpenClawConfig(configPath: string): OpenClawConfig {
  const raw = fs.readFileSync(configPath, "utf-8");
  return JSON.parse(raw);
}

/**
 * 根据 OpenClaw 的 "provider/model-id" 格式解析模型
 * 例如: "vllm/deepseek-v3" → 从 providers.vllm 获取 baseUrl/apiKey，模型 ID 为 deepseek-v3
 */
export function resolveOpenClawModel(
  modelRef: string,
  providers: OpenClawConfig["models"]["providers"]
) {
  const [providerName, modelId] = modelRef.split("/");
  const provider = providers[providerName];

  if (!provider) {
    throw new Error(`未知模型提供商: ${providerName}`);
  }

  const modelInfo = provider.models.find((m) => m.id === modelId);

  return new ChatOpenAI({
    modelName: modelId,
    configuration: {
      baseURL: provider.baseUrl,
      apiKey: provider.apiKey,
    },
    maxTokens: modelInfo?.maxTokens,
  });
}
```

### 2.2 工作空间兼容

读取每个 Agent 的 workspace 目录下的人格文件，自动组装成 `systemPrompt`：

```typescript
// src/registry/workspace-loader.ts

import fs from "node:fs";
import path from "node:path";

interface WorkspacePersona {
  soul: string;        // SOUL.md 内容
  agents: string;      // AGENTS.md 内容
  user: string;        // USER.md 内容
  identity: string;    // IDENTITY.md 内容
  tools: string;       // TOOLS.md 内容
  heartbeat: string;   // HEARTBEAT.md 内容
}

/**
 * 从 OpenClaw 工作空间加载人格文件
 * 按照 OpenClaw 的 Session Startup 协议组装 systemPrompt
 */
export function loadWorkspacePersona(workspaceDir: string): WorkspacePersona {
  const readFile = (name: string) => {
    const filePath = path.join(workspaceDir, name);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, "utf-8");
    }
    return "";
  };

  return {
    soul: readFile("SOUL.md"),
    agents: readFile("AGENTS.md"),
    user: readFile("USER.md"),
    identity: readFile("IDENTITY.md"),
    tools: readFile("TOOLS.md"),
    heartbeat: readFile("HEARTBEAT.md"),
  };
}

/**
 * 将人格文件组装为 systemPrompt
 * 遵循 AGENTS.md 中定义的 Session Startup 协议：
 * 1. SOUL.md → 核心人格
 * 2. USER.md → 用户画像
 * 3. IDENTITY.md → Agent 身份
 * 4. TOOLS.md → 工具备忘
 */
export function buildSystemPrompt(persona: WorkspacePersona): string {
  const sections: string[] = [];

  if (persona.soul) {
    sections.push(`<soul>\n${persona.soul}\n</soul>`);
  }
  if (persona.user) {
    sections.push(`<user_profile>\n${persona.user}\n</user_profile>`);
  }
  if (persona.identity) {
    sections.push(`<identity>\n${persona.identity}\n</identity>`);
  }
  if (persona.agents) {
    sections.push(`<workspace_rules>\n${persona.agents}\n</workspace_rules>`);
  }
  if (persona.tools) {
    sections.push(`<tools_notes>\n${persona.tools}\n</tools_notes>`);
  }

  return sections.join("\n\n");
}
```

### 2.3 完整的兼容 AgentRegistry

```typescript
// src/registry/agent-registry.ts

import { createDeepAgent, FilesystemBackend } from "deepagents";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { watch } from "chokidar";
import path from "node:path";
import fs from "node:fs";
import {
  parseOpenClawConfig,
  resolveOpenClawModel,
  type OpenClawConfig,
} from "./openclaw-config-parser";
import { loadWorkspacePersona, buildSystemPrompt } from "./workspace-loader";

interface AgentEntry {
  id: string;
  name: string;
  workspace: string;
  agentDir?: string;
  skills: string[];
  modelRef: string;
}

export class AgentRegistry {
  private config!: OpenClawConfig;
  private agents = new Map<string, AgentEntry>();
  private configPath: string;
  private checkpointer: PostgresSaver | null = null;
  private watcher: any = null;

  constructor(configPath: string) {
    this.configPath = configPath;
    this.loadConfig();
  }

  private loadConfig() {
    this.config = parseOpenClawConfig(this.configPath);
    const defaults = this.config.agents.defaults;
    const newAgents = new Map<string, AgentEntry>();

    for (const agentCfg of this.config.agents.list) {
      const workspace = agentCfg.workspace || defaults.workspace;

      // 确保工作空间目录存在
      if (workspace && !fs.existsSync(workspace)) {
        fs.mkdirSync(workspace, { recursive: true });
      }

      newAgents.set(agentCfg.id, {
        id: agentCfg.id,
        name: agentCfg.name || agentCfg.id,
        workspace,
        agentDir: agentCfg.agentDir,
        skills: agentCfg.skills || [],
        modelRef: defaults.model.primary,
      });
    }

    this.agents = newAgents;
    console.log(
      `[INFO] [AgentRegistry] 已加载 ${newAgents.size} 个 Agent:`,
      Array.from(newAgents.keys()).join(", ")
    );
  }

  async initCheckpointer() {
    const connString =
      process.env.PG_CONNECTION_STRING ||
      "postgresql://postgres:postgres@localhost:5432/agentdb";
    this.checkpointer = PostgresSaver.fromConnString(connString);
    await this.checkpointer.setup();
    console.log(`[INFO] [AgentRegistry] PostgreSQL Checkpointer 初始化完成`);
  }

  enableHotReload() {
    this.watcher = watch(this.configPath, { ignoreInitial: true });
    this.watcher.on("change", () => {
      console.log(`[INFO] [AgentRegistry] 检测到配置变更，热重载中...`);
      try {
        this.loadConfig();
        console.log(`[INFO] [AgentRegistry] 热重载完成`);
      } catch (err) {
        console.error(`[ERROR] [AgentRegistry] 热重载失败:`, err);
      }
    });
    console.log(`[INFO] [AgentRegistry] 热重载已启用`);
  }

  listAgents() {
    return Array.from(this.agents.values()).map((a) => ({
      id: a.id,
      name: a.name,
      workspace: a.workspace,
      skills: a.skills,
    }));
  }

  /** 创建 Agent 实例 — 读取 OpenClaw 工作空间人格文件 */
  createAgent(agentId: string) {
    const entry = this.agents.get(agentId);
    if (!entry) throw new Error(`Agent "${agentId}" 未注册`);

    // 从工作空间加载人格文件组装 systemPrompt
    const persona = loadWorkspacePersona(entry.workspace);
    const systemPrompt = buildSystemPrompt(persona);

    // 解析模型
    const model = resolveOpenClawModel(
      entry.modelRef,
      this.config.models.providers
    );

    // skills 路径：工作空间内的 skills/ 目录
    const skillsDir = path.join(entry.workspace, "skills");
    const skills = fs.existsSync(skillsDir) ? ["/skills/"] : [];

    // memory 路径：工作空间内的 AGENTS.md 等
    const memoryFiles: string[] = [];
    const agentsMd = path.join(entry.workspace, "AGENTS.md");
    if (fs.existsSync(agentsMd)) memoryFiles.push(agentsMd);

    return createDeepAgent({
      model,
      systemPrompt,
      skills,
      memory: memoryFiles,
      backend: new FilesystemBackend({ rootDir: entry.workspace }),
      checkpointer: this.checkpointer || undefined,
      name: entry.id,
    });
  }
}
```

---

## 3. 工作空间目录结构对照

### OpenClaw 原始结构 → 我们的兼容映射

```
~/.openclaw/                              deepagentsjs/
├── openclaw.json           ←→            agents.json (兼容读取)
│                                         或直接使用 openclaw.json
├── workspace/              ←→            workspaces/main/
│   ├── SOUL.md             ←→            → systemPrompt 组装
│   ├── AGENTS.md           ←→            → memory + 工作规范
│   ├── USER.md             ←→            → systemPrompt 用户画像
│   ├── IDENTITY.md         ←→            → systemPrompt 身份信息
│   ├── TOOLS.md            ←→            → systemPrompt 工具备忘
│   ├── BOOTSTRAP.md        ←→            → 首次运行引导
│   ├── HEARTBEAT.md        ←→            → 心跳任务（可选）
│   ├── memory/             ←→            → Agent 记忆文件系统
│   │   ├── YYYY-MM-DD.md
│   │   └── MEMORY.md
│   └── skills/             ←→            → Agent 技能目录
│       ├── tavily/SKILL.md
│       ├── weather-chart/SKILL.md
│       └── ...
│
├── workspace-doctor/       ←→            workspaces/doctor/
│   ├── SOUL.md (健康助手人格)
│   ├── AGENTS.md
│   └── skills/
│
└── agents/
    ├── main/agent/sessions ←→            PostgreSQL Checkpointer
    └── doctor/agent/sessions ←→          PostgreSQL Checkpointer
```

---

## 4. 配置格式兼容层

为同时支持 `openclaw.json` 和我们的 `agents.yaml` 格式，引入配置适配层：

```typescript
// src/registry/config-adapter.ts

export type ConfigFormat = "openclaw" | "agents-yaml";

export function detectConfigFormat(configPath: string): ConfigFormat {
  if (configPath.endsWith(".json")) return "openclaw";
  return "agents-yaml";
}

export function loadConfig(configPath: string) {
  const format = detectConfigFormat(configPath);

  if (format === "openclaw") {
    return loadOpenClawConfig(configPath);
  }
  return loadAgentsYamlConfig(configPath);
}

/** 将 OpenClaw 的 agents.list 转换为统一的内部格式 */
function loadOpenClawConfig(configPath: string) {
  const oc = parseOpenClawConfig(configPath);
  return {
    providers: oc.models.providers,
    defaultModel: oc.agents.defaults.model.primary,
    defaultWorkspace: oc.agents.defaults.workspace,
    agents: oc.agents.list.map((a) => ({
      id: a.id,
      name: a.name || a.id,
      workspace: a.workspace || oc.agents.defaults.workspace,
      agentDir: a.agentDir,
      skills: a.skills || [],
    })),
  };
}
```

---

## 5. 前端适配

### 5.1 Agent 列表 API 增加 OpenClaw 元数据

```typescript
// GET /api/agents 的返回结构
interface AgentInfo {
  id: string;
  name: string;
  // 从 IDENTITY.md 解析
  identity?: {
    emoji?: string;
    creature?: string;
    vibe?: string;
  };
  // 从 SOUL.md 提取摘要
  soulSummary?: string;
  // 技能列表
  skills: string[];
}
```

### 5.2 前端侧边栏展示 OpenClaw Agent 风格

```
┌──────────────────────┐
│ 🤖 Agent 列表         │
│──────────────────────│
│ 🐱 main              │
│   "通用智能助手"       │
│   tavily, obsidian... │
│                      │
│ 🩺 doctor        ←选中│
│   "健康助手"          │
│   weather-chart...   │
│                      │
│ ──── 会话 ──────── │
│ • doctor:session-001 │
│ • doctor:session-002 │
└──────────────────────┘
```

---

## 6. 启动适配

### 6.1 自动检测配置文件

服务启动时，按优先级查找配置文件：

```typescript
// src/index.ts
const CONFIG_SEARCH_PATHS = [
  "./openclaw.json",                           // 项目目录
  path.join(os.homedir(), ".openclaw/openclaw.json"),  // 用户目录（OpenClaw 标准位置）
  "./agents.yaml",                             // 我们的自有格式
];

function findConfig(): string {
  for (const p of CONFIG_SEARCH_PATHS) {
    if (fs.existsSync(p)) {
      console.log(`[INFO] 使用配置文件: ${p}`);
      return p;
    }
  }
  throw new Error("未找到配置文件 (openclaw.json 或 agents.yaml)");
}

const configPath = process.env.AGENT_CONFIG || findConfig();
const registry = new AgentRegistry(configPath);
```

### 6.2 直接利用现有 OpenClaw 环境

如果用户已有 OpenClaw 安装（如 WSL 中的 `~/.openclaw/`），无需任何额外配置：

```bash
# 直接指向 OpenClaw 配置启动
AGENT_CONFIG=//wsl.localhost/Ubuntu/home/dministrator/.openclaw/openclaw.json bun run dev

# 或在 .env 中设置
AGENT_CONFIG=/home/dministrator/.openclaw/openclaw.json
```

服务将自动：
1. 读取 `openclaw.json` 中定义的 `main` 和 `doctor` Agent
2. 从各自 workspace 加载 `SOUL.md`、`AGENTS.md` 等人格文件
3. 使用 `vllm/deepseek-v3` 模型（DashScope 接口）
4. 加载各自的 skills 目录

---

## 7. 兼容性对照表

| OpenClaw 特性 | 我们的实现 | 兼容性 |
| ------------- | --------- | ------ |
| `openclaw.json` 配置文件 | 直接解析，自动适配 | ✅ 完全兼容 |
| `models.providers` 多模型注册 | 通过 `resolveOpenClawModel()` 映射到 `ChatOpenAI` | ✅ 完全兼容 |
| `agents.defaults` 全局默认 | 合并到每个 Agent 配置 | ✅ 完全兼容 |
| `agents.list[].workspace` 独立工作空间 | `FilesystemBackend({ rootDir })` | ✅ 完全兼容 |
| `SOUL.md` 人格定义 | 读取并注入 systemPrompt | ✅ 完全兼容 |
| `AGENTS.md` 工作规范 | 读取并注入 systemPrompt + memory | ✅ 完全兼容 |
| `USER.md` 用户画像 | 读取并注入 systemPrompt | ✅ 完全兼容 |
| `IDENTITY.md` 身份卡 | 读取并注入 systemPrompt + API 元数据 | ✅ 完全兼容 |
| `TOOLS.md` 工具备忘 | 读取并注入 systemPrompt | ✅ 完全兼容 |
| `skills/` 技能目录 | deepagents skills 中间件加载 | ✅ 完全兼容 |
| `memory/` 日记目录 | FilesystemBackend 文件操作 | ✅ 完全兼容 |
| `bindings[]` 路由规则 | Hono 路由中间件适配 | ⚠️ 部分兼容（HTTP 专用） |
| `channels` 通道集成 | 不直接支持（飞书等需独立插件） | ❌ 不兼容（超出 HTTP 范围） |
| `plugins` 插件系统 | 不直接支持（可通过 tools 扩展） | ⚠️ 部分兼容 |
| `session.scope` 会话隔离 | PostgreSQL Checkpointer + thread_id | ✅ 等效实现 |
| `BOOTSTRAP.md` 首次引导 | Agent 通过文件系统工具自行处理 | ✅ 完全兼容 |
| `HEARTBEAT.md` 心跳任务 | 需额外实现定时器（未来扩展） | ⚠️ 需扩展 |

---

## 8. 新增文件清单

```
services/agent-platform/src/
├── registry/
│   ├── agent-registry.ts       # [修改] 支持 OpenClaw 配置
│   ├── openclaw-config-parser.ts  # [NEW] OpenClaw JSON 解析器
│   ├── workspace-loader.ts     # [NEW] 工作空间人格文件加载
│   └── config-adapter.ts       # [NEW] 配置格式适配层
```

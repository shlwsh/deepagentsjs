/**
 * Agent 注册中心
 *
 * 核心管理类，负责：
 * - 解析 OpenClaw / agents.yaml 配置
 * - 创建隔离的 Agent 实例
 * - 管理 PostgreSQL Checkpointer
 * - 支持配置文件热重载
 */

import { createDeepAgent, FilesystemBackend } from "deepagents";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { ChatOpenAI } from "@langchain/openai";
import { watch } from "chokidar";
import fs from "node:fs";
import path from "node:path";

import { loadConfig, type UnifiedConfig, type UnifiedAgentConfig } from "./config-adapter.js";
import { resolveOpenClawModel, type OpenClawConfig } from "./openclaw-config-parser.js";
import {
  loadWorkspacePersona,
  buildSystemPrompt,
  extractIdentityMeta,
  extractSoulSummary,
} from "./workspace-loader.js";
import type { AgentInfo } from "../types/sse-events.js";

// ─── 类型 ────────────────────────────────────────────────────────

interface AgentEntry {
  config: UnifiedAgentConfig;
  workspaceDir: string;
}

// ─── 主类 ────────────────────────────────────────────────────────

export class AgentRegistry {
  private agents = new Map<string, AgentEntry>();
  private unifiedConfig!: UnifiedConfig;
  private configPath: string;
  private checkpointer: PostgresSaver | null = null;
  private watcher: any = null;

  constructor(configPath: string) {
    this.configPath = configPath;
    this.loadConfigInternal();
  }

  // ─── 配置加载 ────────────────────────────────────────────────

  private loadConfigInternal() {
    this.unifiedConfig = loadConfig(this.configPath);
    const newAgents = new Map<string, AgentEntry>();

    for (const agentCfg of this.unifiedConfig.agents) {
      const workspaceDir = path.resolve(agentCfg.workspace);

      // 确保工作空间目录存在
      if (!fs.existsSync(workspaceDir)) {
        fs.mkdirSync(workspaceDir, { recursive: true });
        console.log(`[INFO] [AgentRegistry] 创建工作空间: ${workspaceDir}`);
      }

      newAgents.set(agentCfg.id, {
        config: agentCfg,
        workspaceDir,
      });
    }

    this.agents = newAgents;
    console.log(
      `[INFO] [AgentRegistry] 已加载 ${newAgents.size} 个 Agent: ` +
      Array.from(newAgents.keys()).join(", ")
    );
  }

  // ─── PostgreSQL Checkpointer ─────────────────────────────────

  /**
   * 初始化 PostgreSQL Checkpointer（服务启动时调用一次）
   */
  async initCheckpointer() {
    const connString =
      process.env.PG_CONNECTION_STRING ||
      "postgresql://postgres:postgres@localhost:5432/agentdb";

    try {
      this.checkpointer = PostgresSaver.fromConnString(connString);
      await this.checkpointer.setup();
      console.log(`[INFO] [AgentRegistry] PostgreSQL Checkpointer 初始化完成 (${connString})`);
    } catch (err) {
      console.error(`[ERROR] [AgentRegistry] PostgreSQL Checkpointer 初始化失败:`, err);
      console.warn(`[WARN] [AgentRegistry] 将以无持久化模式运行`);
      this.checkpointer = null;
    }
  }

  // ─── 热重载 ──────────────────────────────────────────────────

  /**
   * 启动配置文件热重载监听
   */
  enableHotReload() {
    this.watcher = watch(this.configPath, {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 500 },
    });

    this.watcher.on("change", () => {
      console.log(`[INFO] [AgentRegistry] 检测到配置变更，正在热重载...`);
      try {
        this.loadConfigInternal();
        console.log(`[INFO] [AgentRegistry] 热重载完成`);
      } catch (err) {
        console.error(`[ERROR] [AgentRegistry] 热重载失败，保留当前配置:`, err);
      }
    });

    console.log(`[INFO] [AgentRegistry] 热重载已启用，监听 ${this.configPath}`);
  }

  /**
   * 停止热重载监听
   */
  async disableHotReload() {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
      console.log(`[INFO] [AgentRegistry] 热重载已停止`);
    }
  }

  // ─── Agent 查询 ──────────────────────────────────────────────

  /**
   * 列出所有注册的 Agent
   */
  listAgents(): AgentInfo[] {
    return Array.from(this.agents.values()).map(({ config, workspaceDir }) => {
      // 尝试从工作空间提取身份信息
      let identity: AgentInfo["identity"];
      let soulSummary: string | undefined;

      try {
        const persona = loadWorkspacePersona(workspaceDir);
        identity = extractIdentityMeta(persona.identity);
        soulSummary = extractSoulSummary(persona.soul);
      } catch {
        // 忽略读取失败
      }

      return {
        id: config.id,
        name: config.name,
        workspace: workspaceDir,
        skills: config.skills,
        identity,
        soulSummary,
      };
    });
  }

  /**
   * 获取单个 Agent 的信息
   */
  getAgent(agentId: string): AgentInfo | null {
    const entry = this.agents.get(agentId);
    if (!entry) return null;

    const persona = loadWorkspacePersona(entry.workspaceDir);
    return {
      id: entry.config.id,
      name: entry.config.name,
      workspace: entry.workspaceDir,
      skills: entry.config.skills,
      identity: extractIdentityMeta(persona.identity),
      soulSummary: extractSoulSummary(persona.soul),
    };
  }

  // ─── Agent 创建 ──────────────────────────────────────────────

  /**
   * 解析模型配置 — 根据配置格式返回对应的 LLM 实例
   */
  private resolveModel(agentConfig: UnifiedAgentConfig): ChatOpenAI | string {
    // OpenClaw 格式：从 providers 解析
    if (this.unifiedConfig.format === "openclaw") {
      const modelRef = this.unifiedConfig.defaultModel;
      const providers = (this.unifiedConfig.raw as OpenClawConfig).models.providers;
      return resolveOpenClawModel(modelRef, providers, {
        temperature: Number(process.env.LLM_TEMPERATURE) || 0.7,
        timeout: Number(process.env.REQUEST_TIMEOUT) || 60000,
      });
    }

    // agents.yaml 格式：使用 DashScope 或直接传字符串
    const modelName = agentConfig.model || this.unifiedConfig.defaultModel;
    if (modelName === "dashscope" || modelName.startsWith("dashscope:")) {
      return new ChatOpenAI({
        modelName: process.env.DASHSCOPE_MODEL || "deepseek-v3",
        temperature: Number(process.env.LLM_TEMPERATURE) || 0.7,
        configuration: {
          baseURL: process.env.DASHSCOPE_BASE_URL ||
            "https://dashscope.aliyuncs.com/compatible-mode/v1",
          apiKey: process.env.DASHSCOPE_API_KEY,
        },
        timeout: Number(process.env.REQUEST_TIMEOUT) || 60000,
      });
    }

    return modelName;
  }

  /**
   * 根据 ID 创建 Agent 实例
   *
   * 每次调用创建新实例，确保跨请求/跨 Agent 无状态污染
   */
  createAgent(agentId: string) {
    const entry = this.agents.get(agentId);
    if (!entry) {
      throw new Error(
        `[ERROR] Agent "${agentId}" 未注册。可用 Agent: ${Array.from(this.agents.keys()).join(", ")}`
      );
    }

    const { config, workspaceDir } = entry;

    // 加载工作空间人格文件 → systemPrompt
    let systemPrompt: string;
    if (config.systemPrompt) {
      // agents.yaml 中直接定义了 systemPrompt
      systemPrompt = config.systemPrompt;
    } else {
      // 从工作空间 MD 文件组装
      const persona = loadWorkspacePersona(workspaceDir);
      systemPrompt = buildSystemPrompt(persona);
    }

    // 解析模型
    const model = this.resolveModel(config);

    console.log(
      `[INFO] [AgentRegistry] 创建 Agent 实例: ${agentId}, workspace=${workspaceDir}`
    );

    return createDeepAgent({
      model,
      systemPrompt,
      backend: new FilesystemBackend({ rootDir: workspaceDir }),
      checkpointer: this.checkpointer || undefined,
      name: config.id,
    });
  }

  // ─── 辅助方法 ────────────────────────────────────────────────

  /**
   * 检查 Agent 是否存在
   */
  hasAgent(agentId: string): boolean {
    return this.agents.has(agentId);
  }

  /**
   * 获取 Agent 数量
   */
  get agentCount(): number {
    return this.agents.size;
  }
}

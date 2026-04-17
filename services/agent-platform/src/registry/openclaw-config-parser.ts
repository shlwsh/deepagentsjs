/**
 * OpenClaw 配置解析器
 *
 * 解析 OpenClaw 的 openclaw.json 配置文件，
 * 提取 models/providers、agents、bindings 等信息。
 */

import fs from "node:fs";
import { ChatOpenAI } from "@langchain/openai";

// ─── 类型定义 ────────────────────────────────────────────────────

/** 模型信息 */
export interface ModelInfo {
  id: string;
  name: string;
  reasoning: boolean;
  input: string[];
  cost?: Record<string, number>;
  contextWindow: number;
  maxTokens: number;
}

/** 模型提供商配置 */
export interface ModelProvider {
  baseUrl: string;
  apiKey: string;
  api: string;
  models: ModelInfo[];
}

/** Agent 配置项 */
export interface OpenClawAgentConfig {
  id: string;
  name?: string;
  workspace?: string;
  agentDir?: string;
  skills?: string[];
}

/** Agents 全局默认配置 */
export interface AgentDefaults {
  model: { primary: string };
  workspace: string;
  memorySearch?: { enabled: boolean; provider: string };
  compaction?: { mode: string };
  maxConcurrent: number;
  subagents?: { maxConcurrent: number };
}

/** 路由绑定规则 */
export interface Binding {
  type: string;
  agentId: string;
  match: Record<string, string>;
}

/** OpenClaw 完整配置结构 */
export interface OpenClawConfig {
  meta?: { lastTouchedVersion?: string; lastTouchedAt?: string };
  models: {
    mode?: string;
    providers: Record<string, ModelProvider>;
  };
  agents: {
    defaults: AgentDefaults;
    list: OpenClawAgentConfig[];
  };
  tools?: Record<string, unknown>;
  bindings?: Binding[];
  session?: Record<string, string>;
  channels?: Record<string, unknown>;
  plugins?: Record<string, unknown>;
}

// ─── 解析函数 ────────────────────────────────────────────────────

/**
 * 解析 OpenClaw JSON 配置文件
 */
export function parseOpenClawConfig(configPath: string): OpenClawConfig {
  const raw = fs.readFileSync(configPath, "utf-8");
  const config = JSON.parse(raw) as OpenClawConfig;

  // 校验必要字段
  if (!config.models?.providers) {
    throw new Error(`[ERROR] [ConfigParser] 配置缺少 models.providers 字段`);
  }
  if (!config.agents?.list || config.agents.list.length === 0) {
    throw new Error(`[ERROR] [ConfigParser] 配置缺少 agents.list 或列表为空`);
  }

  console.log(
    `[INFO] [ConfigParser] 解析完成 — ${Object.keys(config.models.providers).length} 个模型提供商, ` +
    `${config.agents.list.length} 个 Agent`
  );

  return config;
}

/**
 * 根据 OpenClaw 的 "provider/model-id" 格式解析模型
 *
 * @example resolveOpenClawModel("vllm/deepseek-v3", providers)
 */
export function resolveOpenClawModel(
  modelRef: string,
  providers: Record<string, ModelProvider>,
  overrides?: { temperature?: number; timeout?: number }
): ChatOpenAI {
  const slashIdx = modelRef.indexOf("/");
  if (slashIdx === -1) {
    throw new Error(`[ERROR] [ConfigParser] 无效的模型引用格式: "${modelRef}"，期望 "provider/model-id"`);
  }

  const providerName = modelRef.slice(0, slashIdx);
  const modelId = modelRef.slice(slashIdx + 1);
  const provider = providers[providerName];

  if (!provider) {
    const available = Object.keys(providers).join(", ");
    throw new Error(
      `[ERROR] [ConfigParser] 未知模型提供商: "${providerName}"，可用提供商: ${available}`
    );
  }

  const modelInfo = provider.models.find((m) => m.id === modelId);
  if (!modelInfo) {
    const available = provider.models.map((m) => m.id).join(", ");
    console.warn(
      `[WARN] [ConfigParser] 提供商 "${providerName}" 中未找到模型 "${modelId}"，` +
      `可用模型: ${available}。将尝试直接使用。`
    );
  }

  const llm = new ChatOpenAI({
    modelName: modelId,
    temperature: overrides?.temperature ?? 0.7,
    configuration: {
      baseURL: provider.baseUrl,
      apiKey: provider.apiKey,
    },
    maxTokens: modelInfo?.maxTokens,
    timeout: overrides?.timeout ?? 60000,
  });

  console.log(
    `[INFO] [ConfigParser] 解析模型: ${modelRef} → ` +
    `baseUrl=${provider.baseUrl}, maxTokens=${modelInfo?.maxTokens ?? "default"}`
  );

  return llm;
}

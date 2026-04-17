/**
 * 配置格式适配器
 *
 * 支持 OpenClaw (JSON) 和自有 agents.yaml (YAML) 两种配置格式，
 * 提供统一的内部数据模型。
 */

import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import {
  parseOpenClawConfig,
  type OpenClawConfig,
} from "./openclaw-config-parser.js";

// ─── 统一内部配置模型 ────────────────────────────────────────────

/** 统一的 Agent 配置 */
export interface UnifiedAgentConfig {
  id: string;
  name: string;
  workspace: string;
  agentDir?: string;
  skills: string[];
  model?: string;
  systemPrompt?: string;
}

/** 统一的平台配置 */
export interface UnifiedConfig {
  format: "openclaw" | "agents-yaml";
  raw: OpenClawConfig | any;
  defaultModel: string;
  defaultWorkspace: string;
  agents: UnifiedAgentConfig[];
}

// ─── 格式检测 ────────────────────────────────────────────────────

export type ConfigFormat = "openclaw" | "agents-yaml";

/**
 * 根据文件扩展名检测配置格式
 */
export function detectConfigFormat(configPath: string): ConfigFormat {
  const ext = path.extname(configPath).toLowerCase();
  if (ext === ".json") return "openclaw";
  return "agents-yaml";
}

// ─── 加载函数 ────────────────────────────────────────────────────

/**
 * 将 WSL 中的 /home/ 路径在 Windows 上自动转换为 UNC 路径
 */
function normalizeWorkspacePath(p: string): string {
  if (!p) return p;
  if (process.platform === "win32") {
    if (p.startsWith("/home/") || p.startsWith("\\home\\")) {
      return `\\\\wsl.localhost\\Ubuntu${p.replace(/\\/g, "/")}`;
    }
  }
  return p;
}

/**
 * 统一配置加载入口
 */
export function loadConfig(configPath: string): UnifiedConfig {
  const format = detectConfigFormat(configPath);
  console.log(`[INFO] [ConfigAdapter] 检测到配置格式: ${format} (${configPath})`);

  if (format === "openclaw") {
    return loadOpenClawFormat(configPath);
  }
  return loadAgentsYamlFormat(configPath);
}

/**
 * 加载 OpenClaw JSON 配置
 */
function loadOpenClawFormat(configPath: string): UnifiedConfig {
  const oc = parseOpenClawConfig(configPath);
  const defaults = oc.agents.defaults;

  return {
    format: "openclaw",
    raw: oc,
    defaultModel: defaults.model.primary,
    defaultWorkspace: normalizeWorkspacePath(defaults.workspace),
    agents: oc.agents.list.map((a) => ({
      id: a.id,
      name: a.name || a.id,
      workspace: normalizeWorkspacePath(a.workspace || defaults.workspace),
      agentDir: a.agentDir ? normalizeWorkspacePath(a.agentDir) : undefined,
      skills: a.skills || [],
    })),
  };
}

/**
 * 加载 agents.yaml 自有配置
 */
function loadAgentsYamlFormat(configPath: string): UnifiedConfig {
  const raw = fs.readFileSync(configPath, "utf-8");
  const config = parseYaml(raw);
  const defaults = config.defaults || {};

  return {
    format: "agents-yaml",
    raw: config,
    defaultModel: defaults.model || "dashscope",
    defaultWorkspace: normalizeWorkspacePath(defaults.workspace || "./workspaces"),
    agents: (config.agents || []).map((a: any) => ({
      id: a.id,
      name: a.name || a.id,
      workspace: normalizeWorkspacePath(a.workspace || defaults.workspace || "./workspaces"),
      skills: a.skills || [],
      model: a.model,
      systemPrompt: a.systemPrompt,
    })),
  };
}

/**
 * 工作空间人格文件加载器
 *
 * 从 OpenClaw 工作空间目录加载标准 Markdown 人格文件（SOUL.md、AGENTS.md 等），
 * 并按照 Session Startup 协议组装为 systemPrompt。
 */

import fs from "node:fs";
import path from "node:path";

// ─── 类型定义 ────────────────────────────────────────────────────

/** 工作空间人格文件集合 */
export interface WorkspacePersona {
  soul: string;        // SOUL.md — 核心人格
  agents: string;      // AGENTS.md — 工作规范
  user: string;        // USER.md — 用户画像
  identity: string;    // IDENTITY.md — Agent 身份
  tools: string;       // TOOLS.md — 工具备忘
  heartbeat: string;   // HEARTBEAT.md — 心跳任务
  bootstrap: string;   // BOOTSTRAP.md — 首次引导（一般已删除）
}

/** 从 IDENTITY.md 中提取的结构化身份信息 */
export interface IdentityMeta {
  name?: string;
  emoji?: string;
  creature?: string;
  vibe?: string;
}

// ─── 文件加载 ────────────────────────────────────────────────────

/**
 * 安全读取文件，文件不存在时返回空字符串
 */
function safeReadFile(filePath: string): string {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, "utf-8");
    }
  } catch (err) {
    console.warn(`[WARN] [WorkspaceLoader] 读取文件失败: ${filePath}`, err);
  }
  return "";
}

/**
 * 从 OpenClaw 工作空间加载所有人格文件
 */
export function loadWorkspacePersona(workspaceDir: string): WorkspacePersona {
  const read = (name: string) => safeReadFile(path.join(workspaceDir, name));

  const persona: WorkspacePersona = {
    soul: read("SOUL.md"),
    agents: read("AGENTS.md"),
    user: read("USER.md"),
    identity: read("IDENTITY.md"),
    tools: read("TOOLS.md"),
    heartbeat: read("HEARTBEAT.md"),
    bootstrap: read("BOOTSTRAP.md"),
  };

  const loaded = Object.entries(persona)
    .filter(([, v]) => v.length > 0)
    .map(([k]) => k);

  console.log(
    `[INFO] [WorkspaceLoader] 从 ${workspaceDir} 加载了 ${loaded.length} 个人格文件: ${loaded.join(", ")}`
  );

  return persona;
}

// ─── systemPrompt 组装 ──────────────────────────────────────────

/**
 * 将人格文件组装为 systemPrompt
 *
 * 遵循 OpenClaw AGENTS.md 中定义的 Session Startup 协议：
 * 1. SOUL.md → 核心人格（"who you are"）
 * 2. USER.md → 用户画像（"who you're helping"）
 * 3. IDENTITY.md → Agent 身份元信息
 * 4. AGENTS.md → 工作规范与行为规则
 * 5. TOOLS.md → 工具本地备忘
 */
export function buildSystemPrompt(persona: WorkspacePersona): string {
  const sections: string[] = [];

  if (persona.soul) {
    sections.push(`<soul>\n${persona.soul.trim()}\n</soul>`);
  }

  if (persona.user) {
    sections.push(`<user_profile>\n${persona.user.trim()}\n</user_profile>`);
  }

  if (persona.identity) {
    sections.push(`<identity>\n${persona.identity.trim()}\n</identity>`);
  }

  if (persona.agents) {
    sections.push(`<workspace_rules>\n${persona.agents.trim()}\n</workspace_rules>`);
  }

  if (persona.tools) {
    sections.push(`<tools_notes>\n${persona.tools.trim()}\n</tools_notes>`);
  }

  // 不将 HEARTBEAT.md 和 BOOTSTRAP.md 注入 systemPrompt
  // 它们通过文件系统工具由 Agent 自行读取

  return sections.join("\n\n");
}

// ─── 身份元信息提取 ──────────────────────────────────────────────

/**
 * 从 IDENTITY.md 内容中提取结构化身份字段
 *
 * 匹配格式：
 *   - **Name:** xxx
 *   - **Emoji:** xxx
 */
export function extractIdentityMeta(identityContent: string): IdentityMeta {
  const meta: IdentityMeta = {};

  const patterns: Array<[keyof IdentityMeta, RegExp]> = [
    ["name", /\*\*(?:Name|名字)[:\uff1a]\*\*\s*(.+)/i],
    ["emoji", /\*\*(?:Emoji|emoji)[:\uff1a]\*\*\s*(.+)/i],
    ["creature", /\*\*(?:Creature|生物|类型)[:\uff1a]\*\*\s*(.+)/i],
    ["vibe", /\*\*(?:Vibe|风格|情绪)[:\uff1a]\*\*\s*(.+)/i],
  ];

  for (const [key, regex] of patterns) {
    const match = identityContent.match(regex);
    if (match?.[1]) {
      const value = match[1].trim();
      // 排除模板占位符
      if (value && !value.startsWith("_(") && value !== "") {
        meta[key] = value;
      }
    }
  }

  return meta;
}

/**
 * 从 SOUL.md 首行或首段提取摘要
 */
export function extractSoulSummary(soulContent: string): string {
  if (!soulContent) return "";

  const lines = soulContent.split("\n").filter((l) => l.trim().length > 0);
  // 跳过标题行（以 # 开头）
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("#") && !trimmed.startsWith("_") && trimmed.length > 5) {
      return trimmed.slice(0, 100);
    }
  }

  return lines[0]?.trim().slice(0, 100) || "";
}

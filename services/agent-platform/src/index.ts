/**
 * 多 Agent 智能体平台 — Hono 服务入口
 *
 * 启动流程：
 * 1. 自动检测配置文件（openclaw.json 或 agents.yaml）
 * 2. 初始化 AgentRegistry + PostgreSQL Checkpointer
 * 3. 启用配置热重载
 * 4. 挂载 Hono 路由并启动 HTTP 服务
 */

import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serve } from "@hono/node-server";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { AgentRegistry } from "./registry/agent-registry.js";
import { createAgentRoutes } from "./routes/agents.js";

// ─── 配置文件查找 ────────────────────────────────────────────────

const CONFIG_SEARCH_PATHS = [
  "./openclaw.json",
  "./agents.yaml",
  "./agents.json",
  path.join(os.homedir(), ".openclaw/openclaw.json"),
];

function findConfig(): string {
  // 优先使用环境变量指定的路径
  if (process.env.AGENT_CONFIG) {
    const envPath = path.resolve(process.env.AGENT_CONFIG);
    if (fs.existsSync(envPath)) {
      return envPath;
    }
    console.warn(
      `[WARN] [服务] 环境变量 AGENT_CONFIG 指定的路径不存在: ${envPath}`
    );
  }

  for (const p of CONFIG_SEARCH_PATHS) {
    const resolved = path.resolve(p);
    if (fs.existsSync(resolved)) {
      return resolved;
    }
  }

  throw new Error(
    `[ERROR] 未找到配置文件。搜索路径:\n` +
    CONFIG_SEARCH_PATHS.map((p) => `  - ${path.resolve(p)}`).join("\n") +
    `\n请创建 openclaw.json 或 agents.yaml，或通过 AGENT_CONFIG 环境变量指定。`
  );
}

// ─── 服务启动 ────────────────────────────────────────────────────

async function main() {
  console.log("╔═══════════════════════════════════════════════════╗");
  console.log("║    多 Agent 智能体平台 — 启动中                    ║");
  console.log("╚═══════════════════════════════════════════════════╝");

  // 1. 查找并加载配置
  const configPath = findConfig();
  console.log(`[INFO] [服务] 使用配置文件: ${configPath}`);

  const registry = new AgentRegistry(configPath);
  console.log(`[INFO] [服务] Agent 注册完成 (${registry.agentCount} 个 Agent)`);

  // 2. 初始化 PostgreSQL Checkpointer
  await registry.initCheckpointer();

  // 3. 启用配置热重载
  registry.enableHotReload();

  // 4. 创建 Hono 应用
  const app = new Hono();

  // 全局中间件
  app.use("*", logger());
  app.use(
    "*",
    cors({
      origin: [
        "http://localhost:5173",  // Vite 开发服务器
        "http://localhost:3000",  // 本地前端
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
      ],
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    })
  );

  // 健康检查
  app.get("/api/health", (c) => {
    return c.json({
      status: "ok",
      agents: registry.agentCount,
      timestamp: new Date().toISOString(),
    });
  });

  // 挂载 Agent 路由
  app.route("/api/agents", createAgentRoutes(registry));

  // 404 处理
  app.notFound((c) => {
    return c.json({ success: false, error: "路由未找到" }, 404);
  });

  // 全局错误处理
  app.onError((err, c) => {
    console.error(`[ERROR] [服务] 未捕获异常:`, err);
    return c.json({ success: false, error: "服务器内部错误" }, 500);
  });

  // 5. 启动 HTTP 服务
  const port = Number(process.env.PORT) || 3000;

  serve(
    { fetch: app.fetch, port },
    (info) => {
      console.log("");
      console.log("╔═══════════════════════════════════════════════════╗");
      console.log(`║  🚀 服务已启动                                     ║`);
      console.log(`║  📡 地址: http://localhost:${info.port}                 ║`);
      console.log(`║  📋 Agent 列表: http://localhost:${info.port}/api/agents ║`);
      console.log(`║  💚 健康检查: http://localhost:${info.port}/api/health   ║`);
      console.log("╚═══════════════════════════════════════════════════╝");
      console.log("");

      // 打印已注册的 Agent
      const agents = registry.listAgents();
      for (const agent of agents) {
        const emoji = agent.identity?.emoji || "🤖";
        console.log(
          `  ${emoji} ${agent.id} — ${agent.soulSummary || agent.name} ` +
          `(${agent.skills.length} 技能)`
        );
      }
      console.log("");
    }
  );
}

// ─── 进程错误处理 ────────────────────────────────────────────────

process.on("unhandledRejection", (err) => {
  console.error("[ERROR] [服务] 未处理的 Promise 拒绝:", err);
});

process.on("uncaughtException", (err) => {
  console.error("[ERROR] [服务] 未捕获异常:", err);
  process.exit(1);
});

// ─── 启动 ────────────────────────────────────────────────────────

main().catch((err) => {
  console.error("[ERROR] [服务] 启动失败:", err);
  process.exit(1);
});

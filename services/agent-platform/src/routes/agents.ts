/**
 * Agent 管理与调用路由
 *
 * 提供 Agent 列表、同步调用和 SSE 流式调用三类 API：
 * - GET  /api/agents          — 列出所有 Agent
 * - GET  /api/agents/:id      — 获取单个 Agent 详情
 * - POST /api/agents/:id/invoke — 同步调用 Agent
 * - POST /api/agents/:id/stream — SSE 流式调用 Agent
 */

import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { HumanMessage } from "@langchain/core/messages";
import type { AgentRegistry } from "../registry/agent-registry.js";
import { classifyEvent } from "../utils/event-classifier.js";
import type { ChatRequest } from "../types/sse-events.js";

/**
 * 创建 Agent 路由
 */
export function createAgentRoutes(registry: AgentRegistry) {
  const app = new Hono();

  // ─── GET /api/agents — 列出所有可用 Agent ────────────────────
  app.get("/", (c) => {
    const agents = registry.listAgents();
    return c.json({
      success: true,
      data: agents,
      total: agents.length,
    });
  });

  // ─── GET /api/agents/:id — 获取单个 Agent 详情 ───────────────
  app.get("/:id", (c) => {
    const agentId = c.req.param("id");
    const agent = registry.getAgent(agentId);

    if (!agent) {
      return c.json({ success: false, error: `Agent "${agentId}" 未找到` }, 404);
    }

    return c.json({ success: true, data: agent });
  });

  // ─── POST /api/agents/:id/invoke — 同步调用 ──────────────────
  app.post("/:id/invoke", async (c) => {
    const agentId = c.req.param("id");

    if (!registry.hasAgent(agentId)) {
      return c.json({ success: false, error: `Agent "${agentId}" 未找到` }, 404);
    }

    try {
      const body = await c.req.json<ChatRequest>();
      const { messages, threadId } = body;

      if (!messages || messages.length === 0) {
        return c.json({ success: false, error: "messages 不能为空" }, 400);
      }

      const agent = registry.createAgent(agentId);
      const langchainMessages = messages.map(
        (m) => new HumanMessage({ content: m.content })
      );

      const result = await agent.invoke(
        { messages: langchainMessages },
        {
          configurable: {
            thread_id: threadId || `${agentId}:${Date.now()}`,
          },
        }
      );

      // 提取最终消息
      const lastMsg = result.messages[result.messages.length - 1];
      const content = typeof lastMsg.content === "string"
        ? lastMsg.content
        : JSON.stringify(lastMsg.content);

      return c.json({
        success: true,
        data: {
          content,
          threadId: threadId || `${agentId}:${Date.now()}`,
          messageCount: result.messages.length,
        },
      });
    } catch (err: any) {
      console.error(`[ERROR] [AgentRoute] invoke 失败:`, err);
      return c.json(
        { success: false, error: err.message || "内部错误" },
        500
      );
    }
  });

  // ─── POST /api/agents/:id/stream — SSE 流式调用 ──────────────
  app.post("/:id/stream", async (c) => {
    const agentId = c.req.param("id");

    if (!registry.hasAgent(agentId)) {
      return c.json({ success: false, error: `Agent "${agentId}" 未找到` }, 404);
    }

    try {
      const body = await c.req.json<ChatRequest>();
      const { messages, threadId } = body;

      if (!messages || messages.length === 0) {
        return c.json({ success: false, error: "messages 不能为空" }, 400);
      }

      const agent = registry.createAgent(agentId);
      const langchainMessages = messages.map(
        (m) => new HumanMessage({ content: m.content })
      );

      const configuredThreadId = threadId || `${agentId}:${Date.now()}`;

      return streamSSE(c, async (stream) => {
        try {
          // 发送初始连接事件
          await stream.writeSSE({
            event: "connected",
            data: JSON.stringify({
              agentId,
              threadId: configuredThreadId,
              timestamp: new Date().toISOString(),
            }),
          });

          const agentStream = await agent.stream(
            { messages: langchainMessages },
            {
              streamMode: "updates",
              subgraphs: true,
              configurable: { thread_id: configuredThreadId },
            }
          );

          for await (const [namespace, chunk] of agentStream) {
            for (const [nodeName, data] of Object.entries(chunk)) {
              const event = classifyEvent(namespace, nodeName, data);
              await stream.writeSSE({
                event: event.type,
                data: JSON.stringify(event),
              });
            }
          }

          // 发送完成事件
          await stream.writeSSE({
            event: "done",
            data: JSON.stringify({
              threadId: configuredThreadId,
              timestamp: new Date().toISOString(),
            }),
          });
        } catch (err: any) {
          console.error(`[ERROR] [AgentRoute] stream 失败:`, err);
          await stream.writeSSE({
            event: "error",
            data: JSON.stringify({
              type: "error",
              timestamp: new Date().toISOString(),
              source: "main",
              node: "error",
              data: { content: err.message || "流式传输异常" },
            }),
          });
        }
      });
    } catch (err: any) {
      console.error(`[ERROR] [AgentRoute] stream 请求解析失败:`, err);
      return c.json(
        { success: false, error: err.message || "请求格式错误" },
        400
      );
    }
  });

  return app;
}

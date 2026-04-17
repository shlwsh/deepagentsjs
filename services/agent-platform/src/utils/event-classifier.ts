/**
 * SSE 事件分类器
 *
 * 将 LangGraph 的 [namespace, chunk] 流数据分类为前端可读的 SSE 事件。
 * 基于 deepagentsjs 的 streaming lifecycle 模式。
 */

import type { SSEEvent, SSEEventType } from "../types/sse-events.js";

/**
 * 对 LangGraph stream 的 [namespace, chunk] 数据进行事件分类
 *
 * @param namespace - LangGraph namespace 数组。[] 表示主 Agent，["tools:UUID"] 表示子代理
 * @param nodeName  - LangGraph 节点名称（model_request, tools 等）
 * @param data      - 节点输出数据
 */
export function classifyEvent(
  namespace: string[],
  nodeName: string,
  data: any
): SSEEvent {
  const isMainAgent = namespace.length === 0;
  const isSubagent = namespace.length > 0;
  const source = isMainAgent ? "main" : namespace.join("|");
  const timestamp = new Date().toISOString();

  // ─── 主 Agent 的模型回复 ──────────────────────────────────────
  if (isMainAgent && nodeName === "model_request") {
    const messages = data?.messages || [];
    for (const msg of messages) {
      // 检测 tool_call（可能是子代理启动 task 或普通工具）
      if (msg.tool_calls?.length > 0) {
        for (const tc of msg.tool_calls) {
          if (tc.name === "task") {
            return {
              type: "subagent_start",
              timestamp,
              source,
              node: nodeName,
              data: {
                subagentName: tc.args?.subagent_type,
                content: tc.args?.description,
                status: "pending",
              },
            };
          }
          // 普通工具调用
          return {
            type: "tool_call",
            timestamp,
            source,
            node: nodeName,
            data: {
              toolName: tc.name,
              toolArgs: tc.args,
            },
          };
        }
      }

      // todo 更新
      if (msg.tool_calls?.some((tc: any) => tc.name === "write_todos")) {
        return {
          type: "todo_update",
          timestamp,
          source,
          node: nodeName,
          data: {
            todos: msg.tool_calls.find((tc: any) => tc.name === "write_todos")?.args?.todos,
          },
        };
      }

      // 文件操作
      if (msg.tool_calls?.some((tc: any) =>
        ["write_file", "read_file", "delete_file"].includes(tc.name)
      )) {
        return {
          type: "file_update",
          timestamp,
          source,
          node: nodeName,
          data: {
            content: JSON.stringify(msg.tool_calls.map((tc: any) => ({
              tool: tc.name,
              args: tc.args,
            }))),
          },
        };
      }

      // 普通文本回复 → thinking
      if (msg.content) {
        const content = typeof msg.content === "string"
          ? msg.content
          : JSON.stringify(msg.content);
        return {
          type: "thinking",
          timestamp,
          source,
          node: nodeName,
          data: { content },
        };
      }
    }
  }

  // ─── 主 Agent 的 tools 节点（工具结果返回）────────────────────
  if (isMainAgent && nodeName === "tools") {
    const messages = data?.messages || [];
    for (const msg of messages) {
      if (msg.type === "tool") {
        return {
          type: "tool_result",
          timestamp,
          source,
          node: nodeName,
          data: {
            toolName: msg.name,
            toolResult: typeof msg.content === "string"
              ? msg.content.slice(0, 500)
              : msg.content,
          },
        };
      }
    }
    // 子代理完成
    for (const msg of messages) {
      if (msg.type === "tool" && msg.tool_call_id) {
        return {
          type: "subagent_complete",
          timestamp,
          source,
          node: nodeName,
          data: {
            status: "complete",
            content: typeof msg.content === "string"
              ? msg.content.slice(0, 300)
              : JSON.stringify(msg.content).slice(0, 300),
          },
        };
      }
    }
  }

  // ─── 子代理事件 ──────────────────────────────────────────────
  if (isSubagent) {
    let eventType: SSEEventType = "subagent_thinking";
    let content = "";

    if (nodeName === "model_request") {
      const messages = data?.messages || [];
      for (const msg of messages) {
        if (msg.content) {
          content = typeof msg.content === "string"
            ? msg.content
            : JSON.stringify(msg.content);
          break;
        }
      }
    } else {
      content = JSON.stringify(data).slice(0, 500);
    }

    return {
      type: eventType,
      timestamp,
      source,
      node: nodeName,
      data: {
        content,
        subagentName: namespace[0]?.split(":")[0] || "subagent",
      },
    };
  }

  // ─── 兜底：未识别的事件 ──────────────────────────────────────
  return {
    type: "thinking",
    timestamp,
    source,
    node: nodeName,
    data: {
      content: typeof data === "string" ? data : JSON.stringify(data).slice(0, 300),
    },
  };
}

/**
 * SSE 流式通信 Composable
 *
 * 管理与后端 Agent 的 SSE 连接，
 * 解析流事件并驱动 UI 更新。
 */

import { ref, onUnmounted } from "vue";

export interface SSEEvent {
  type: string;
  timestamp: string;
  source: string;
  node: string;
  data: {
    content?: string;
    toolName?: string;
    toolArgs?: any;
    toolResult?: any;
    subagentName?: string;
    status?: string;
    todos?: any[];
    files?: Record<string, any>;
  };
}

export function useSSE() {
  const events = ref<SSEEvent[]>([]);
  const isStreaming = ref(false);
  const error = ref<string | null>(null);
  let controller: AbortController | null = null;

  async function sendMessage(
    agentId: string,
    messages: Array<{ role: string; content: string }>,
    threadId?: string
  ) {
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

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error || `HTTP ${response.status}`);
      }

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
            const data = line.slice(6).trim();
            if (!data) continue;

            try {
              const parsed = JSON.parse(data);

              // 检查是否是 done 事件
              if (parsed.threadId && !parsed.type) {
                // connected 或 done payload
                continue;
              }

              events.value.push(parsed as SSEEvent);
            } catch {
              // 非 JSON 数据，忽略
            }
          }
        }
      }
    } catch (e: any) {
      if (e.name !== "AbortError") {
        error.value = e.message;
        console.error("[SSE] 连接错误:", e);
      }
    } finally {
      isStreaming.value = false;
    }
  }

  function abort() {
    controller?.abort();
    isStreaming.value = false;
  }

  function clearEvents() {
    events.value = [];
  }

  onUnmounted(() => abort());

  return { events, isStreaming, error, sendMessage, abort, clearEvents };
}

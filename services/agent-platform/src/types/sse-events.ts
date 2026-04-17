/**
 * SSE 事件协议定义
 *
 * 前后端之间的 SSE 事件采用统一的协议格式，
 * 涵盖 Agent 的完整执行链路。
 */

/** SSE 事件类型 */
export type SSEEventType =
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

/** SSE 事件结构体 */
export interface SSEEvent {
  type: SSEEventType;
  timestamp: string;
  source: string;            // "main" 或子代理名称
  node: string;              // LangGraph 节点名
  data: {
    content?: string;
    toolName?: string;
    toolArgs?: unknown;
    toolResult?: unknown;
    subagentName?: string;
    status?: string;
    todos?: unknown[];
    files?: Record<string, unknown>;
  };
}

/** Agent 列表项信息 */
export interface AgentInfo {
  id: string;
  name: string;
  workspace: string;
  skills: string[];
  identity?: {
    emoji?: string;
    creature?: string;
    vibe?: string;
  };
  soulSummary?: string;
}

/** 聊天请求体 */
export interface ChatRequest {
  messages: Array<{ role: string; content: string }>;
  threadId?: string;
}

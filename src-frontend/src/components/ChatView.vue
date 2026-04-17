<template>
  <main class="chat-view">
    <!-- 顶部标题栏 -->
    <header class="chat-header" v-if="activeAgent">
      <span class="header-emoji">{{ activeAgent.identity?.emoji || '🤖' }}</span>
      <div class="header-info">
        <h1 class="header-name">{{ activeAgent.name }}</h1>
        <span class="header-desc">{{ activeAgent.soulSummary || `${activeAgent.skills.length} 个技能` }}</span>
      </div>
      <div class="header-badge" v-if="isStreaming">
        <span class="streaming-dot"></span>
        思考中
      </div>
    </header>

    <!-- 空状态 -->
    <div class="empty-state" v-if="!activeAgent">
      <div class="empty-icon">🧠</div>
      <h2>选择一个智能体开始对话</h2>
      <p>从左侧列表中选择一个 Agent</p>
    </div>

    <!-- 消息区域 -->
    <div class="messages-container" ref="messagesContainer" v-if="activeAgent">
      <!-- 欢迎消息 -->
      <div class="welcome-card" v-if="chatMessages.length === 0 && events.length === 0">
        <div class="welcome-emoji">{{ activeAgent.identity?.emoji || '🤖' }}</div>
        <h2>你好，我是 {{ activeAgent.name }}</h2>
        <p>{{ activeAgent.soulSummary || '有什么我可以帮你的吗？' }}</p>
      </div>

      <!-- 消息列表 -->
      <template v-for="(msg, idx) in chatMessages" :key="idx">
        <!-- 用户消息 -->
        <div class="message message-user" v-if="msg.role === 'user'">
          <div class="message-avatar">👤</div>
          <div class="message-bubble user-bubble">{{ msg.content }}</div>
        </div>

        <!-- Agent 响应区 -->
        <div class="message message-agent" v-else>
          <div class="message-avatar">{{ activeAgent.identity?.emoji || '🤖' }}</div>
          <div class="message-content">
            <div class="message-bubble agent-bubble" v-html="msg.content"></div>
          </div>
        </div>
      </template>

      <!-- 流式链路事件 -->
      <div class="stream-events" v-if="events.length > 0">
        <div class="message message-agent">
          <div class="message-avatar">{{ activeAgent.identity?.emoji || '🤖' }}</div>
          <div class="message-content">
            <template v-for="(evt, idx) in events" :key="idx">
              <!-- 思考过程 -->
              <div class="chain-card thinking" v-if="evt.type === 'thinking' && evt.data.content">
                <div class="chain-header">
                  <span class="chain-icon">💭</span>
                  <span>思考</span>
                </div>
                <div class="chain-body" v-html="renderMarkdown(evt.data.content)"></div>
              </div>

              <!-- 工具调用 -->
              <div class="chain-card tool-call" v-if="evt.type === 'tool_call'">
                <div class="chain-header">
                  <span class="chain-icon">🔧</span>
                  <span>调用工具: <strong>{{ evt.data.toolName }}</strong></span>
                </div>
                <pre class="chain-body code">{{ JSON.stringify(evt.data.toolArgs, null, 2) }}</pre>
              </div>

              <!-- 工具结果 -->
              <div class="chain-card tool-result" v-if="evt.type === 'tool_result'">
                <div class="chain-header">
                  <span class="chain-icon">✅</span>
                  <span>工具结果: <strong>{{ evt.data.toolName }}</strong></span>
                </div>
                <div class="chain-body">{{ typeof evt.data.toolResult === 'string' ? evt.data.toolResult : JSON.stringify(evt.data.toolResult) }}</div>
              </div>

              <!-- 子代理启动 -->
              <div class="chain-card subagent-start" v-if="evt.type === 'subagent_start'">
                <div class="chain-header">
                  <span class="chain-icon">🤖</span>
                  <span>委派子代理: <strong>{{ evt.data.subagentName }}</strong></span>
                  <span class="status-badge pending">{{ evt.data.status }}</span>
                </div>
                <div class="chain-body" v-if="evt.data.content">{{ evt.data.content }}</div>
              </div>

              <!-- 子代理思考 -->
              <div class="chain-card subagent-thinking" v-if="evt.type === 'subagent_thinking'">
                <div class="chain-header">
                  <span class="chain-icon">🔄</span>
                  <span>{{ evt.data.subagentName || evt.source }}</span>
                </div>
                <div class="chain-body">{{ evt.data.content }}</div>
              </div>

              <!-- 子代理完成 -->
              <div class="chain-card subagent-complete" v-if="evt.type === 'subagent_complete'">
                <div class="chain-header">
                  <span class="chain-icon">✅</span>
                  <span>子代理完成</span>
                </div>
                <div class="chain-body">{{ evt.data.content }}</div>
              </div>
            </template>

            <!-- 流式思考动画 -->
            <div class="thinking-indicator" v-if="isStreaming">
              <span class="dot"></span>
              <span class="dot"></span>
              <span class="dot"></span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 输入栏 -->
    <div class="input-bar" v-if="activeAgent">
      <div class="input-wrapper">
        <textarea
          ref="inputEl"
          v-model="inputText"
          class="input-field"
          :placeholder="`给 ${activeAgent.name} 发消息...`"
          rows="1"
          @keydown.enter.exact.prevent="handleSend"
          @input="autoResize"
        ></textarea>
        <button
          class="send-btn"
          :class="{ active: inputText.trim().length > 0, streaming: isStreaming }"
          @click="isStreaming ? abort() : handleSend()"
          :title="isStreaming ? '停止' : '发送'"
        >
          <span v-if="isStreaming">⏹</span>
          <span v-else>↑</span>
        </button>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from "vue";
import { useAgentStore } from "../stores/agents";
import { useSSE } from "../composables/useSSE";
import { marked } from "marked";

const agentStore = useAgentStore();
const activeAgent = computed(() => agentStore.activeAgent);

const { events, isStreaming, error, sendMessage, abort, clearEvents } = useSSE();

const inputText = ref("");
const inputEl = ref<HTMLTextAreaElement | null>(null);
const messagesContainer = ref<HTMLDivElement | null>(null);

interface ChatMessage {
  role: "user" | "agent";
  content: string;
}

const chatMessages = ref<ChatMessage[]>([]);

function renderMarkdown(text: string): string {
  try {
    return marked.parse(text) as string;
  } catch {
    return text;
  }
}

function autoResize() {
  const el = inputEl.value;
  if (el) {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }
}

function scrollToBottom() {
  nextTick(() => {
    const container = messagesContainer.value;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  });
}

async function handleSend() {
  const text = inputText.value.trim();
  if (!text || !activeAgent.value) return;

  // 如果有上一轮的流式事件，合并为一条 Agent 消息
  if (events.value.length > 0) {
    const thinkingContent = events.value
      .filter((e) => e.type === "thinking" && e.data.content)
      .map((e) => e.data.content)
      .join("");

    if (thinkingContent) {
      chatMessages.value.push({
        role: "agent",
        content: renderMarkdown(thinkingContent),
      });
    }
    clearEvents();
  }

  // 添加用户消息
  chatMessages.value.push({ role: "user", content: text });
  inputText.value = "";
  autoResize();
  scrollToBottom();

  // 发起流式请求
  await sendMessage(
    activeAgent.value.id,
    [{ role: "user", content: text }]
  );

  scrollToBottom();
}

// 自动滚动
watch(() => events.value.length, () => {
  scrollToBottom();
});

// 切换 Agent 时清空
watch(() => agentStore.activeAgentId, () => {
  chatMessages.value = [];
  clearEvents();
});
</script>

<style scoped>
.chat-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-primary);
  min-width: 0;
}

/* 顶部栏 */
.chat-header {
  height: var(--header-height);
  padding: 0 var(--space-xl);
  border-bottom: 1px solid var(--border-default);
  display: flex;
  align-items: center;
  gap: var(--space-md);
  background: var(--bg-secondary);
  flex-shrink: 0;
}

.header-emoji {
  font-size: 28px;
}

.header-info {
  flex: 1;
}

.header-name {
  font-size: var(--font-size-lg);
  font-weight: 600;
  margin: 0;
}

.header-desc {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
}

.header-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 20px;
  background: rgba(88, 166, 255, 0.1);
  color: var(--accent-primary);
  font-size: var(--font-size-xs);
  font-weight: 500;
}

.streaming-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent-primary);
  animation: pulse 1.5s ease infinite;
}

/* 空状态 */
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-md);
  color: var(--text-muted);
}

.empty-icon {
  font-size: 64px;
  opacity: 0.5;
}

.empty-state h2 {
  font-size: var(--font-size-xl);
  font-weight: 500;
  color: var(--text-secondary);
}

.empty-state p {
  font-size: var(--font-size-sm);
}

/* 欢迎卡片 */
.welcome-card {
  text-align: center;
  padding: var(--space-2xl);
  animation: fadeIn 0.5s ease;
}

.welcome-emoji {
  font-size: 56px;
  margin-bottom: var(--space-lg);
}

.welcome-card h2 {
  font-size: var(--font-size-2xl);
  font-weight: 600;
  margin-bottom: var(--space-sm);
  background: var(--gradient-primary);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.welcome-card p {
  color: var(--text-secondary);
}

/* 消息容器 */
.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-xl);
  display: flex;
  flex-direction: column;
  gap: var(--space-xl);
}

/* 消息通用 */
.message {
  display: flex;
  gap: var(--space-md);
  animation: fadeIn 0.3s ease;
}

.message-avatar {
  width: 36px;
  height: 36px;
  border-radius: var(--border-radius-md);
  background: var(--bg-elevated);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}

.message-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.message-bubble {
  padding: var(--space-md) var(--space-lg);
  border-radius: var(--border-radius-lg);
  line-height: 1.6;
  max-width: 75%;
}

.user-bubble {
  background: var(--accent-primary);
  color: var(--text-inverse);
  border-bottom-right-radius: var(--border-radius-sm);
  margin-left: auto;
}

.message-user {
  flex-direction: row-reverse;
}

.agent-bubble {
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-bottom-left-radius: var(--border-radius-sm);
}

.agent-bubble :deep(p) {
  margin: 0 0 var(--space-sm) 0;
}

.agent-bubble :deep(p:last-child) {
  margin-bottom: 0;
}

/* 链路卡片 */
.chain-card {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-default);
  border-radius: var(--border-radius-md);
  overflow: hidden;
  animation: slideIn 0.2s ease;
}

.chain-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  background: var(--surface-glass);
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-default);
}

.chain-icon {
  font-size: 14px;
}

.chain-body {
  padding: var(--space-md);
  font-size: var(--font-size-sm);
  color: var(--text-primary);
  line-height: 1.5;
}

.chain-body.code {
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  background: var(--bg-primary);
  margin: 0;
  border-radius: 0;
  border: none;
}

.chain-card.tool-call {
  border-color: rgba(88, 166, 255, 0.2);
}

.chain-card.tool-result {
  border-color: rgba(63, 185, 80, 0.2);
}

.chain-card.subagent-start {
  border-color: rgba(188, 140, 255, 0.2);
}

.status-badge {
  margin-left: auto;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: var(--font-size-xs);
  font-weight: 500;
}

.status-badge.pending {
  background: rgba(210, 153, 34, 0.15);
  color: var(--accent-warning);
}

/* 思考动画 */
.thinking-indicator {
  display: flex;
  gap: 6px;
  padding: var(--space-md);
}

.thinking-indicator .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-muted);
  animation: pulse 1.4s ease infinite;
}

.thinking-indicator .dot:nth-child(2) {
  animation-delay: 0.2s;
}

.thinking-indicator .dot:nth-child(3) {
  animation-delay: 0.4s;
}

/* 输入栏 */
.input-bar {
  padding: var(--space-lg) var(--space-xl);
  border-top: 1px solid var(--border-default);
  background: var(--bg-secondary);
  flex-shrink: 0;
}

.input-wrapper {
  display: flex;
  align-items: flex-end;
  gap: var(--space-sm);
  background: var(--bg-primary);
  border: 1px solid var(--border-default);
  border-radius: var(--border-radius-xl);
  padding: var(--space-sm) var(--space-sm) var(--space-sm) var(--space-lg);
  transition: border-color var(--transition-fast);
}

.input-wrapper:focus-within {
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.1);
}

.input-field {
  flex: 1;
  resize: none;
  min-height: 24px;
  max-height: 120px;
  line-height: 24px;
  font-size: var(--font-size-md);
  color: var(--text-primary);
}

.input-field::placeholder {
  color: var(--text-muted);
}

.send-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: bold;
  transition: all var(--transition-fast);
  background: var(--bg-elevated);
  color: var(--text-muted);
  flex-shrink: 0;
}

.send-btn.active {
  background: var(--accent-primary);
  color: white;
}

.send-btn.active:hover {
  background: var(--accent-primary-hover);
  transform: scale(1.05);
}

.send-btn.streaming {
  background: var(--accent-danger);
  color: white;
}

.stream-events {
  animation: fadeIn 0.3s ease;
}
</style>

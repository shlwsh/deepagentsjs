<template>
  <aside class="sidebar">
    <div class="sidebar-header">
      <div class="logo">
        <span class="logo-icon">🧠</span>
        <span class="logo-text">Agent 平台</span>
      </div>
    </div>

    <div class="sidebar-section">
      <div class="section-title">智能体</div>
      <div
        v-for="agent in agentStore.agents"
        :key="agent.id"
        class="agent-item"
        :class="{ active: agent.id === agentStore.activeAgentId }"
        @click="agentStore.selectAgent(agent.id)"
      >
        <span class="agent-emoji">{{ agent.identity?.emoji || '🤖' }}</span>
        <div class="agent-info">
          <div class="agent-name">{{ agent.name }}</div>
          <div class="agent-desc">{{ agent.soulSummary || `${agent.skills.length} 个技能` }}</div>
        </div>
      </div>
    </div>

    <div class="sidebar-footer">
      <div class="status-dot" :class="{ online: agentStore.agents.length > 0 }"></div>
      <span class="status-text">
        {{ agentStore.agents.length }} 个智能体在线
      </span>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { useAgentStore } from "../stores/agents";
const agentStore = useAgentStore();
</script>

<style scoped>
.sidebar {
  width: var(--sidebar-width);
  min-width: var(--sidebar-width);
  height: 100%;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-default);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sidebar-header {
  padding: var(--space-lg) var(--space-xl);
  border-bottom: 1px solid var(--border-default);
}

.logo {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.logo-icon {
  font-size: 24px;
}

.logo-text {
  font-size: var(--font-size-lg);
  font-weight: 600;
  background: var(--gradient-primary);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.sidebar-section {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-md);
}

.section-title {
  font-size: var(--font-size-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--text-muted);
  padding: var(--space-sm) var(--space-md);
  margin-bottom: var(--space-xs);
}

.agent-item {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-md) var(--space-lg);
  border-radius: var(--border-radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
  margin-bottom: 2px;
}

.agent-item:hover {
  background: var(--surface-glass-hover);
}

.agent-item.active {
  background: var(--surface-glass-active);
  border: 1px solid var(--border-accent);
  box-shadow: var(--shadow-glow);
}

.agent-emoji {
  font-size: 28px;
  flex-shrink: 0;
}

.agent-info {
  min-width: 0;
}

.agent-name {
  font-weight: 500;
  font-size: var(--font-size-md);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.agent-desc {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-footer {
  padding: var(--space-lg);
  border-top: 1px solid var(--border-default);
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-muted);
}

.status-dot.online {
  background: var(--accent-success);
  box-shadow: 0 0 8px rgba(63, 185, 80, 0.4);
}

.status-text {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
}
</style>

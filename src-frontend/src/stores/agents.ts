/**
 * Agent 状态管理 Store
 */
import { defineStore } from "pinia";
import { ref, computed } from "vue";

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

export const useAgentStore = defineStore("agents", () => {
  const agents = ref<AgentInfo[]>([]);
  const activeAgentId = ref<string | null>(null);
  const loading = ref(false);

  const activeAgent = computed(() =>
    agents.value.find((a) => a.id === activeAgentId.value) || null
  );

  async function fetchAgents() {
    loading.value = true;
    try {
      const res = await fetch("/api/agents");
      const json = await res.json();
      if (json.success) {
        agents.value = json.data;
        // 自动选中第一个
        if (!activeAgentId.value && agents.value.length > 0) {
          activeAgentId.value = agents.value[0].id;
        }
      }
    } catch (err) {
      console.error("[AgentStore] 获取 Agent 列表失败:", err);
    } finally {
      loading.value = false;
    }
  }

  function selectAgent(id: string) {
    activeAgentId.value = id;
  }

  return { agents, activeAgentId, activeAgent, loading, fetchAgents, selectAgent };
});

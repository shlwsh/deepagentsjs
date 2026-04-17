<template>
  <div class="app-layout">
    <AgentSidebar />
    <ChatView />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import { useAgentStore } from "./stores/agents";
import AgentSidebar from "./components/AgentSidebar.vue";
import ChatView from "./components/ChatView.vue";

const agentStore = useAgentStore();

onMounted(() => {
  agentStore.fetchAgents();
});
</script>

<style scoped>
.app-layout {
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}
</style>

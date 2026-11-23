<script setup lang="ts">
import { onMounted } from "vue";
import { connected, ensureAxon, initializing, statusDetail } from "../axon";

onMounted(() => {
  ensureAxon();
});
</script>

<template>
  <div class="axon-status" :class="{ 'is-live': connected, 'is-idle': !connected && !initializing }">
    <span class="dot" />
    <strong class="label">{{ connected ? "交互模式" : initializing ? "探测后端…" : "纯文档模式" }}</strong>
    <span class="detail">{{ statusDetail }}</span>
    <a v-if="!connected && !initializing" class="hint" href="/guide/quickstart#在-axongui-里打开文档">
      怎么打开交互模式 →
    </a>
  </div>
</template>

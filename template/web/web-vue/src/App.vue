<script setup lang="ts">
import JSCallPY from "./components/JSCallPY.vue";
</script>

<template>
  <img src="./assets/axon.svg" class="logo" alt="Axon" />
  <h1>Axon + Vue 3</h1>
  <p class="hint">点下面的按钮，页面会真的调用 Python 里的方法。</p>
  <div>
    <JSCallPY />
  </div>
</template>

<style scoped>
.logo {
  height: 96px;
  will-change: filter;
  transition: filter 300ms;
}
.logo:hover {
  filter: drop-shadow(0 0 1.6em #3451b2aa);
}
h1 {
  font-size: 2rem;
  margin: 0.4em 0 0.2em;
}
.hint {
  color: var(--vp-c-text-2, #666);
  margin-bottom: 1.6em;
}
</style>

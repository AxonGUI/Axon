<script setup lang="ts">
import JSCallPY from "./components/JSCallPY.vue";
</script>

<template>
  <img src="./assets/axon.svg" class="logo vue" alt="Vue logo" />
  <JSCallPY />
</template>

<style scoped>
.logo {
  height: 100px;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}
.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}
.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}
</style>

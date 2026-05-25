<script setup lang="ts">
import { Axon } from "axon";
import { ref } from "vue";
const value_from_py = ref("");
declare module "axon" {
  interface AxonPYController {
    JSCallPYController: {
      onCall: any;
    };
  }
}

function onClick() {
  Axon.JSCallPYController.onCall(["js-to-py-arg1", "js-to-py-arg2"], {
    jskwargs: "jskwargs",
  }).then((res) => {
    value_from_py.value = res;
  });
}
</script>

<template>
  <button @click="onClick">click to call py func</button>
  <p>value from py : {{ value_from_py }}</p>
</template>

<style scoped></style>

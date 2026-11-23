<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  connected,
  ensureAxon,
  getAxonLib,
  initializing,
  pushLog,
  setActiveSink,
  type LogEntry,
} from "../axon";
import { demos } from "../demos";

const props = defineProps<{ id: string }>();
const demo = computed(() => demos[props.id]);

const entries = ref<LogEntry[]>([]);
const running = ref(false);
const summary = ref("");
const showCode = ref(false);

onMounted(() => {
  ensureAxon();
});

async function run() {
  if (running.value || !demo.value) return;
  entries.value = [];
  summary.value = "";
  running.value = true;
  setActiveSink((entry) => entries.value.push(entry));
  pushLog({ kind: "info", title: `▶ 开始执行示例「${demo.value.title}」` });
  try {
    const lib = await getAxonLib();
    const text = await demo.value.run(lib);
    if (text) summary.value = text;
  } catch (err: any) {
    pushLog({ kind: "error", title: "示例本身出错", detail: String(err?.message ?? err) });
  } finally {
    setActiveSink(null);
    running.value = false;
  }
}

const directionLabel: Record<string, string> = {
  js2py: "JS → PY",
  py2js: "PY → JS",
  event: "事件",
  info: "本地",
  error: "异常",
};
</script>

<template>
  <section v-if="demo" class="live-demo" :data-demo-id="id">
    <header class="live-demo__head">
      <div>
        <h3 class="live-demo__title">{{ demo.title }}</h3>
        <p class="live-demo__summary">{{ demo.summary }}</p>
      </div>
      <button class="live-demo__run" :disabled="running || !connected" @click="run">
        {{ running ? "执行中…" : connected ? "运行示例" : "需要 Python 后端" }}
      </button>
    </header>

    <p v-if="!connected && !initializing" class="live-demo__offline">
      当前是纯文档模式：页面没有连到 Python 后端，所以按钮不可点。用
      <code>python docs/main.py</code> 打开后，这里会变成真正可点的示例。
    </p>

    <div class="live-demo__code">
      <button class="live-demo__toggle" @click="showCode = !showCode">
        {{ showCode ? "收起代码" : "查看代码" }}
      </button>
      <pre v-show="showCode"><code>{{ demo.code }}</code></pre>
    </div>

    <ol v-if="entries.length" class="live-demo__flow">
      <li v-for="(entry, index) in entries" :key="index" :class="`entry entry--${entry.kind}`">
        <div class="entry__head">
          <span class="entry__dir">{{ directionLabel[entry.kind] ?? entry.kind }}</span>
          <span class="entry__title">{{ entry.title }}</span>
          <span v-if="entry.ms !== undefined" class="entry__ms">{{ entry.ms }} ms</span>
        </div>
        <pre v-if="entry.payload !== undefined" class="entry__json">{{
          JSON.stringify(entry.payload, null, 2)
        }}</pre>
        <pre v-if="entry.result !== undefined" class="entry__json entry__json--result">{{
          JSON.stringify(entry.result, null, 2)
        }}</pre>
        <p v-if="entry.detail" class="entry__detail">{{ entry.detail }}</p>
      </li>
    </ol>

    <p v-if="summary" class="live-demo__summary-out">✓ {{ summary }}</p>
  </section>
  <p v-else class="live-demo__offline">未知示例：{{ id }}</p>
</template>

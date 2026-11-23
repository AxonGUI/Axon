import { AxonInit } from "axon-gui";
import { createApp } from "vue";
import App from "./App.vue";
import "./style.css";

// AxonInit() 会先探测通道: 在 AxonGUI 里返回 { connected: true },
// 直接拿浏览器打开则返回 { connected: false } —— 此时页面依然可以正常渲染。
const status = await AxonInit();
if (!status.ready) {
  console.warn("[axon] 没有连上 Python 后端:", status.reason ?? status.error);
}

createApp(App).mount("#app");

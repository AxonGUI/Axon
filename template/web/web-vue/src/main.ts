import { AxonInit } from "axon";
import { createApp } from "vue";
import App from "./App.vue";
import "./style.css";

await AxonInit();
createApp(App).mount("#app");

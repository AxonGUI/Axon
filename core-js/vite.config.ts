import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
export default defineConfig({
  build: {
    target: "ESNext",
    lib: {
      entry: "./lib/index.ts",
      name: "axon",
      fileName: "axon",
    },
    // 不设 external: promise-retry / uuid / qwebchannel 全部打进产物,
    // 这样 file: 或 vendor 进来的 dist 是自包含的（消费方不用额外装这几个包）。
    rollupOptions: {},
  },
  optimizeDeps: { esbuildOptions: { define: { global: "globalThis" } } },
  plugins: [
    // rollupTypes: false —— 让 tsc 按源码结构出多份 .d.ts。API Extractor 把没从
    // 入口重新导出的内部类型塞进 declare module "./Xxx" 里，消费方解析不到
    // （IAxonChannels / AxonJSCallHandler / AxonPYCall 就是这样丢的）。
    dts({ insertTypesEntry: true, rollupTypes: false, copyDtsFiles: true }),
  ],
});

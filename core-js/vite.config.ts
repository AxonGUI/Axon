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
    dts({ insertTypesEntry: true, rollupTypes: true, copyDtsFiles: true }),
  ],
});

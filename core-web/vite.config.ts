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
    rollupOptions: {
      external: ["uuid", "promise-retry", "qwebchannel/qwebchannel.js"],
      output: {
        globals: {
          "qwebchannel/qwebchannel.js": "QWebChannel",
        },
      },
    },
  },
  optimizeDeps: { esbuildOptions: { define: { global: "globalThis" } } },
  plugins: [
    dts({ insertTypesEntry: true, rollupTypes: true, copyDtsFiles: true }),
  ],
});

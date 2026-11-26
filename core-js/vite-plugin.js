// axon-gui 的 Vite 插件：开发时自动生成类型（Python 控制器 → TS，前端控制器 → Python）。
//
// 只在 `vite`（dev server）里跑，`vite build` 不跑——构建不该依赖 Python 环境；
// CI 里要校验就显式调 `npm run types:check`。
//
//   import { axonTypes } from "axon-gui/vite-plugin";
//   plugins: [vue(), axonTypes()]
//
import { spawn } from "node:child_process";

const DEFAULTS = {
  /** 执行生成器的命令；带参数。找不到第一个时退回 `python -m axon.typecodegen` */
  command: ["axon-gui", "types"],
  /** 生成器参数（--controllers / --out / --js / --py-out 等） */
  args: [],
  /** 触发重新生成的文件后缀 */
  extensions: [".py", ".ts", ".tsx", ".js", ".jsx", ".mts", ".vue"],
  /** 防抖毫秒 */
  delay: 200,
  /** 是否打印生成器的输出 */
  log: true,
};

/**
 * @param {Partial<typeof DEFAULTS>} options
 * @returns {import("vite").Plugin}
 */
export function axonTypes(options = {}) {
  const opts = { ...DEFAULTS, ...options };
  /** @type {import("node:child_process").ChildProcess | null} */
  let running = null;
  let pending = false;
  let timer = null;

  const run = () => {
    if (running) {
      pending = true;
      return;
    }
    const [cmd, ...cmdArgs] = opts.command;
    const args = [...cmdArgs, ...opts.args];
    running = spawn(cmd, args, { stdio: opts.log ? "inherit" : "ignore", shell: process.platform === "win32" });
    running.on("error", () => {
      // 退化：venv 里的 python -m axon.typecodegen
      running = spawn("python", ["-m", "axon.typecodegen", ...opts.args], {
        stdio: opts.log ? "inherit" : "ignore",
        shell: process.platform === "win32",
      });
      running.on("error", (err) => {
        console.warn("[axon-types] 找不到生成器（先 pip install axon-gui）:", err.message);
        running = null;
      });
      running.on("exit", done);
    });
    running.on("exit", done);
  };

  const done = () => {
    running = null;
    if (pending) {
      pending = false;
      run();
    }
  };

  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(run, opts.delay);
  };

  return {
    name: "axon-gui:types",
    apply: "serve",
    configResolved() {
      run();
    },
    configureServer(server) {
      server.watcher.on("change", (file) => {
        if (opts.extensions.some((ext) => file.endsWith(ext))) schedule();
      });
      server.watcher.on("add", (file) => {
        if (opts.extensions.some((ext) => file.endsWith(ext))) schedule();
      });
    },
  };
}

export default axonTypes;

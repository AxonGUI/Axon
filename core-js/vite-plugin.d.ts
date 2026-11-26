import type { Plugin } from "vite";

export interface AxonTypesOptions {
  /** 执行生成器的命令（默认 `["axon-gui", "types"]`；找不到就退回 `python -m axon.typecodegen`） */
  command?: string[];
  /** 传给生成器的参数，例如 `["--controllers", "controller", "--out", "src/axon.generated.ts"]` */
  args?: string[];
  /** 触发重新生成的文件后缀 */
  extensions?: string[];
  /** 防抖毫秒 */
  delay?: number;
  /** 是否把生成器输出打印到终端 */
  log?: boolean;
}

/** 开发时自动生成两端类型（只在 dev server 里跑）。 */
export declare function axonTypes(options?: AxonTypesOptions): Plugin;
export default axonTypes;

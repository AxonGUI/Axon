import { ref } from "vue";

/**
 * 文档站的 Axon 运行时状态。
 *
 * 同一份页面既可以在普通浏览器里当纯说明书（AxonInit 返回 connected:false），
 * 也可以在 AxonGUI 窗口里当可交互示例（通道连通后按钮可直接调 Python）。
 */
export type LogKind = "js2py" | "py2js" | "event" | "info" | "error";

export interface LogEntry {
  kind: LogKind;
  title: string;
  detail?: string;
  payload?: unknown;
  result?: unknown;
  ms?: number;
}

export const connected = ref(false);
export const initializing = ref(true);
export const statusDetail = ref("正在探测 Python 后端…");
export const logs = ref<LogEntry[]>([]);

let libModule: any = null;
let initPromise: Promise<boolean> | null = null;
let activeSink: ((entry: LogEntry) => void) | null = null;

export function setActiveSink(sink: ((entry: LogEntry) => void) | null) {
  activeSink = sink;
}

export function pushLog(entry: LogEntry) {
  logs.value = [...logs.value, entry].slice(-80);
  activeSink?.(entry);
}

export function clearLogs() {
  logs.value = [];
}

/** 页面里替 Python 端准备的一个 JS 控制器，用来演示 Python → JS 方向。 */
function createDocsJsController() {
  return {
    value: 7,
    mirror(payload: unknown) {
      pushLog({
        kind: "py2js",
        title: "DocsJS.mirror() 被 Python 调用",
        payload,
      });
      return { mirrored: payload, at: new Date().toISOString() };
    },
    async sleepEcho(payload: unknown, ms: number) {
      pushLog({
        kind: "py2js",
        title: "DocsJS.sleepEcho() 被 Python 调用",
        payload: { payload, ms },
      });
      await new Promise((resolve) => setTimeout(resolve, Math.min(Number(ms) || 0, 5000)));
      return `slept ${ms}ms`;
    },
    note(text: unknown) {
      pushLog({ kind: "py2js", title: "DocsJS.note() 被广播调用", payload: text });
      return `窗口收到: ${String(text)}`;
    },
  };
}

export async function getAxonLib(): Promise<any> {
  if (!libModule) {
    libModule = await import("axon-gui");
    libModule.AxonController.register("DocsJS", createDocsJsController());
  }
  return libModule;
}

/** 初始化（幂等）。返回是否处于「已连上 Python」模式。 */
export function ensureAxon(): Promise<boolean> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      const lib = await getAxonLib();
      const status = await lib.AxonInit();
      connected.value = !!status.ready;
      if (status.ready) {
        statusDetail.value = `通道对象：${(status.objects ?? []).join("、")}`;
      } else if (status.reason === "no-qt-transport") {
        statusDetail.value = "纯文档模式：没有检测到 Python 后端，示例按钮不可用";
      } else {
        statusDetail.value = `连接失败（${status.reason ?? "unknown"}）：${status.error ?? ""}`;
      }
      // 给自动化验证脚本一个会合点（普通浏览器里同样存在，只是 connected=false）
      (globalThis as any).__axonDocs = {
        connected: connected.value,
        status: statusDetail.value,
      };
      return connected.value;
    } catch (err: any) {
      connected.value = false;
      statusDetail.value = `初始化异常：${err?.message || err}`;
      return false;
    } finally {
      initializing.value = false;
    }
  })();
  return initPromise;
}

import { packCallArgs } from "./Axon";
import { AxonCall } from "./AxonJSCall";

/**
 * 跨窗口交互：在 A 窗口里调 B 窗口的 JS 控制器，或者一次打到所有窗口。
 *
 * ```ts
 * // 有哪些窗口
 * const webs = await AxonCross.windows();        // ["main", "charts"]
 *
 * // 指名道姓调另一个窗口
 * await AxonCross.web("charts").Charts.reload("600s");
 * await AxonCross.call({ web: "charts", controller: "Charts", func: "reload", args: ["600s"] });
 *
 * // 一次打到所有窗口（各自返回自己的结果）
 * const results = await AxonCross.broadcast({ controller: "Toasts", func: "show", args: ["已保存"] });
 *
 * // 发事件：所有窗口 / 指定窗口（对方用 AxonEvent.addListener 接）
 * await AxonCross.emit("theme:changed", "dark");
 * await AxonCross.emitTo("charts", "theme:changed", "dark");
 * ```
 *
 * 为什么要过 Python 一手：只有 Python 知道现在到底有哪些窗口活着，
 * 窗口之间也没有直连的通道；顺带还能在 Python 里统一做超时和错误隔离。
 */
const HANDLER = "AxonCrossCallHandler";

/** 一次跨窗口调用可能等多久（毫秒）。 */
export interface AxonCrossTimeout {
  timeout?: number;
}

export interface AxonCrossCallOptions extends AxonCrossTimeout {
  /** 目标窗口名，就是建 AxonGUI 时给的第一个参数 */
  web: string;
  /** JS 侧注册的控制器名 */
  controller: string;
  func: string;
  args?: any[];
  kwargs?: Record<string, any>;
}

export interface AxonCrossBroadcastOptions extends AxonCrossTimeout {
  controller: string;
  func: string;
  args?: any[];
  kwargs?: Record<string, any>;
  /** 不发给这些窗口（比如自己） */
  exclude?: string[];
}

/** 广播时每个窗口各自的结果：一个窗口失败不影响别的窗口。 */
export interface AxonCrossResult {
  web: string;
  ok: boolean;
  value?: any;
  error?: string;
}

export type AxonCrossCallArgs = {
  (args?: any[], kwargs?: Record<string, any>, timeout?: number): Promise<any>;
  (...args: any[]): Promise<any>;
};

function request<T = any>(payload: Record<string, any>, timeout?: number): Promise<T> {
  return AxonCall.call({
    controller_id: HANDLER,
    func: "onCall",
    args: [payload],
    timeout,
  }) as Promise<T>;
}

const AxonCrossImpl = {
  /** 现在还活着的窗口名。 */
  windows(): Promise<string[]> {
    return request<string[]>({ action: "windows" });
  },

  /** 这个窗口还在不在。 */
  async has(web: string): Promise<boolean> {
    return (await AxonCrossImpl.windows()).includes(web);
  },

  /**
   * 直接调另一个窗口，写法跟 `Axon.xxx` 一样：
   * `AxonCross.web("charts").Charts.reload("600s")`
   */
  web(web: string) {
    return new Proxy(
      {},
      {
        get(_, controller: string) {
          return new Proxy(
            {},
            {
              get(_, prop: string) {
                return (...callArgs: any[]) =>
                  request({
                    action: "call",
                    web_name: web,
                    controller_id: controller,
                    func: prop,
                    ...packCallArgs(callArgs),
                  });
              },
            },
          );
        },
      },
    ) as Record<string, Record<string, AxonCrossCallArgs>>;
  },

  /** 调另一个窗口里的一个方法，参数/超时写法同 `Axon`。 */
  call({ web, controller, func, args = [], kwargs, timeout }: AxonCrossCallOptions) {
    return request(
      {
        action: "call",
        web_name: web,
        controller_id: controller,
        func,
        args,
        kwargs,
        timeout,
      },
      timeout,
    );
  },

  /** 一次打到所有窗口，返回每个窗口自己的结果。 */
  broadcast({
    controller,
    func,
    args = [],
    kwargs,
    timeout,
    exclude,
  }: AxonCrossBroadcastOptions) {
    return request<AxonCrossResult[]>(
      {
        action: "broadcast",
        controller_id: controller,
        func,
        args,
        kwargs,
        timeout,
        exclude,
      },
      timeout,
    );
  },

  /** 发一个事件给所有窗口（对方用 `AxonEvent.addListener(type, fn)` 接）。 */
  emit(type: string, ...args: any[]): Promise<{ count: number }> {
    return request({ action: "emit", type, args });
  },

  /** 发一个事件给指定窗口。 */
  emitTo(web: string, type: string, ...args: any[]): Promise<any> {
    return request({
      action: "call",
      web_name: web,
      controller_id: "AxonEvent",
      func: "dispatchEvent",
      args: [type, ...args],
    });
  },
};

export const AxonCross = AxonCrossImpl;

import promiseRetry from "promise-retry";
import { QWebChannel } from "qwebchannel/qwebchannel.js";
import { WebName } from "./types";

export interface IAxonChannels {
  AxonEnv: {
    web_name: WebName;
  };
}

export const AxonChannels = {} as IAxonChannels;

/** 通道连接的当前状态 —— 供「检测到 Python 后台」这类双模式页面判断。 */
export interface IAxonChannelStatus {
  /** 是否真的连上了 QWebChannel */
  connected: boolean;
  /** 失败原因: 没有 qt 传输对象 / 重试耗尽 */
  reason?: "no-qt-transport" | "retry-exhausted";
  /** 后端注册的对象名, 例如 ["AxonEnv", "AxonJSCallHandler", "AxonPYCall"] */
  objects: string[];
  error?: string;
}

export let AxonChannelStatus: IAxonChannelStatus = {
  connected: false,
  objects: [],
};

let initPromise: Promise<IAxonChannelStatus> | undefined;

/**
 * 初始化 QWebChannel。
 *
 * 与旧版不同: 失败不再抛异常, 而是返回状态对象。这样同一份前端代码可以
 * 既跑在 AxonGUI 里（有 window.qt.webChannelTransport）, 也跑在普通浏览器里
 * （当作纯静态文档）。
 */
export function initChannels(): Promise<IAxonChannelStatus> {
  if (initPromise) return initPromise;
  initPromise = (async (): Promise<IAxonChannelStatus> => {
    if (typeof window === "undefined" || !(window as any).qt) {
      AxonChannelStatus = {
        connected: false,
        reason: "no-qt-transport",
        objects: [],
      };
      return AxonChannelStatus;
    }
    try {
      await promiseRetry(
        () =>
          new Promise<void>((resolve) => {
            new QWebChannel((window as any).qt.webChannelTransport, function (
              channel: any,
            ) {
              Object.assign(AxonChannels, channel.objects);
              resolve();
            });
          }),
        { retries: 50, minTimeout: 10, maxTimeout: 10 },
      );
      AxonChannelStatus = {
        connected: true,
        objects: Object.keys(AxonChannels),
      };
    } catch (err: any) {
      AxonChannelStatus = {
        connected: false,
        reason: "retry-exhausted",
        objects: [],
        error: err?.message || String(err),
      };
      console.error(
        `[AxonChannel] QWebChannel 初始化彻底失败。 - 重试次数: 50 - 错误信息: ${AxonChannelStatus.error}`,
      );
    }
    return AxonChannelStatus;
  })();
  return initPromise;
}

/** 是否已连上 Python 后台（同步查询, 需在 initChannels/AxonInit 之后调用）。 */
export function isAxonConnected(): boolean {
  return AxonChannelStatus.connected;
}

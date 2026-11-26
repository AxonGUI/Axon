import { AxonChannels, initChannels, AxonChannelStatus } from "./AxonChannel.ts";
import type { IAxonChannelStatus } from "./AxonChannel.ts";
import { AxonCall } from "./AxonJSCall.ts";
import { AxonPYCallHandler } from "./AxonPYCallHandler.ts";
import { AxonStore } from "./AxonStore.ts";

export type * from "./Axon.ts";
export type { AxonControllers, AxonFacade } from "./Axon.ts";
export { Axon } from "./Axon.ts";
export { AxonCross } from "./AxonCross.ts";
export type {
  AxonCrossBroadcastOptions,
  AxonCrossCallOptions,
  AxonCrossResult,
} from "./AxonCross.ts";
export { AxonChannels, AxonChannelStatus, initChannels, isAxonConnected } from "./AxonChannel.ts";
export type { IAxonChannelStatus } from "./AxonChannel.ts";
export type * from "./AxonEvent.ts";
export { AxonEvent } from "./AxonEvent.ts";
export type * from "./AxonEventQt.ts";
export type * from "./AxonJSCall.ts";
export { AxonCall } from "./AxonJSCall.ts";
export { AxonError, AxonNotConnectedError, AxonRemoteError, AxonTimeoutError } from "./AxonError.ts";
export { AxonController } from "./AxonPYCallHandler.ts";
export { AxonStore } from "./AxonStore.ts";

/** AxonInit 的返回值 —— 前端据此决定"交互模式"还是"纯文档模式"。 */
/** 当前页面跑在哪种形态里：`app` = 有 Python 后端，`web` = 纯网页。 */
export type AxonMode = "app" | "web";

export interface IAxonInitResult {
  /**
   * 一句话判断形态：`mode === "app"` 就是能用后端，`"web"` 就是纯网页。
   *
   * 它就是 `ready ? "app" : "web"` 的糖——想区分「通道通了但对象没齐」
   * 这种中间态，再看 `connected` / `reason`。
   */
  mode: AxonMode;
  /** 通道是否连通 */
  connected: boolean;
  /** 全链路（通道 + 双向调用 + store）是否就绪 */
  ready: boolean;
  /** 连接失败原因 */
  reason?: IAxonChannelStatus["reason"];
  /** 后端对象名 */
  objects: string[];
  error?: string;
}

/**
 * 初始化 Axon JS 侧。
 *
 * 返回状态而不是抛错: 普通浏览器里调用会得到 `{connected:false, ready:false}`,
 * 页面可以据此退化成纯静态说明书。
 */
export async function AxonInit(): Promise<IAxonInitResult> {
  const status = await initChannels();
  const base: IAxonInitResult = {
    mode: "web",
    connected: status.connected,
    ready: false,
    reason: status.reason,
    objects: status.objects,
    error: status.error,
  };
  if (!status.connected) {
    return base;
  }
  await AxonPYCallHandler.init();
  await AxonCall.init();
  await AxonStore.init();
  await notifyPyReady();
  return { ...base, ready: true, mode: "app" };
}

/**
 * 告诉 Python「前端已经能收事件了」。
 *
 * QWebEngine 的 loadFinished 通常早于这里的握手完成, Python 侧据此把
 * loadFinished 事件攒到前端报到之后再派发（见 AxonGUI.mark_js_channel_ready）。
 */
async function notifyPyReady(): Promise<void> {
  const env = (AxonChannels as unknown as { AxonEnv?: { ready?: () => Promise<void> } })
    .AxonEnv;
  if (!env || typeof env.ready !== "function") return;
  try {
    await env.ready();
  } catch (err) {
    console.warn("[AxonInit] 通知 Python 前端就绪失败:", err);
  }
}

/** 同步查询是否已就绪。 */
export function isAxonReady(): boolean {
  return AxonChannelStatus.connected && !!AxonChannelsReady();
}

function AxonChannelsReady(): boolean {
  // 三个内置对象都在才算 ready, 避免半初始化状态下调用报 undefined
  const channels = AxonChannelStatus.objects;
  return (
    channels.includes("AxonEnv") &&
    channels.includes("AxonJSCallHandler") &&
    channels.includes("AxonPYCall")
  );
}

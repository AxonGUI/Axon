import { WebName } from './types.js';
export interface IAxonChannels {
    AxonEnv: {
        web_name: WebName;
    };
}
export declare const AxonChannels: IAxonChannels;
/** 通道连接的当前状态 —— 供「检测到 Python 后台」这类双模式页面判断。 */
export interface IAxonChannelStatus {
    /** 是否真的连上了 QWebChannel */
    connected: boolean;
    /** 失败原因: 没有 qt 传输对象 / 重试耗尽 / 页面卸载（连上过，后来断了） */
    reason?: "no-qt-transport" | "retry-exhausted" | "page-unloaded";
    /** 后端注册的对象名, 例如 ["AxonEnv", "AxonJSCallHandler", "AxonPYCall"] */
    objects: string[];
    error?: string;
}
export declare let AxonChannelStatus: IAxonChannelStatus;
/**
 * 初始化 QWebChannel。
 *
 * 与旧版不同: 失败不再抛异常, 而是返回状态对象。这样同一份前端代码可以
 * 既跑在 AxonGUI 里（有 window.qt.webChannelTransport）, 也跑在普通浏览器里
 * （当作纯静态文档）。
 */
export declare function initChannels(): Promise<IAxonChannelStatus>;
/**
 * 通道中途断开（页面即将卸载）：把状态改回「未连接」。
 *
 * 页面卸载是正常生命周期的一部分，但**在飞的调用**不会再有回包，
 * 所以状态也必须跟着变——否则 UI 仍以为后端在线，继续发永远等不到的调用。
 */
export declare function markChannelDisconnected(reason: "page-unloaded"): void;
/** 是否已连上 Python 后台（同步查询, 需在 initChannels/AxonInit 之后调用）。 */
export declare function isAxonConnected(): boolean;

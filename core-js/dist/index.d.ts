import { IAxonChannelStatus } from './AxonChannel.js';

export type * from './Axon.js';
export type { AxonControllers, AxonFacade } from './Axon.js';
export { Axon } from './Axon.js';
export { AxonCross } from './AxonCross.js';
export type { AxonCrossBroadcastOptions, AxonCrossCallOptions, AxonCrossResult, } from './AxonCross.js';
export { AxonChannels, AxonChannelStatus, initChannels, isAxonConnected } from './AxonChannel.js';
export type { IAxonChannelStatus } from './AxonChannel.js';
export type * from './AxonEvent.js';
export { AxonEvent } from './AxonEvent.js';
export type * from './AxonEventQt.js';
export type * from './AxonJSCall.js';
export { AxonCall } from './AxonJSCall.js';
export { AxonError, AxonNotConnectedError, AxonRemoteError, AxonTimeoutError } from './AxonError.js';
export { AxonController } from './AxonPYCallHandler.js';
export { AxonStore } from './AxonStore.js';
/** AxonInit 的返回值 —— 前端据此决定"交互模式"还是"纯文档模式"。 */
export interface IAxonInitResult {
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
export declare function AxonInit(): Promise<IAxonInitResult>;
/** 同步查询是否已就绪。 */
export declare function isAxonReady(): boolean;

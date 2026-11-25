import { IAxonChannelStatus } from './AxonChannel.ts';

export type * from './Axon.ts';
export { Axon } from './Axon.ts';
export { AxonCross } from './AxonCross.ts';
export type { AxonCrossBroadcastOptions, AxonCrossCallOptions, AxonCrossResult, } from './AxonCross.ts';
export { AxonChannels, AxonChannelStatus, initChannels, isAxonConnected } from './AxonChannel.ts';
export type { IAxonChannelStatus } from './AxonChannel.ts';
export type * from './AxonEvent.ts';
export { AxonEvent } from './AxonEvent.ts';
export type * from './AxonEventQt.ts';
export type * from './AxonJSCall.ts';
export { AxonCall } from './AxonJSCall.ts';
export { AxonController } from './AxonPYCallHandler.ts';
export { AxonStore } from './AxonStore.ts';
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

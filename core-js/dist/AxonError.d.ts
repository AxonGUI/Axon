/**
 * Axon 的错误基类：两端抛出来的错误都从这里派生，`instanceof` 才可用。
 *
 * 之前有几处直接 `reject("字符串")`，`catch (e) { e.message }` 会得到 undefined。
 */
export declare class AxonError extends Error {
    /** 稳定的机器可读错误码，便于在 catch 里分流而不是匹配文案。 */
    readonly code: string;
    constructor(message: string, options?: {
        code?: string;
        name?: string;
        cause?: unknown;
    });
}
/** 等不到 Python 回包（`timeout` 到期）。 */
export declare class AxonTimeoutError extends AxonError {
    constructor(message?: string);
}
/** 通道还没连上就发起了调用。 */
export declare class AxonNotConnectedError extends AxonError {
    constructor(message?: string);
}
/** 通道**中途**断开：页面卸载、渲染进程退出。
 *
 * 和 `AxonNotConnectedError` 的区别是「有没有连上过」：那个是调用根本发不出去，
 * 这个是调用已经发出去了、回包永远不会来。以前这种 Promise 永远悬着。
 */
export declare class AxonChannelLostError extends AxonError {
    constructor(message?: string);
}
/** Python 侧抛出的异常，被转成 JS 错误。 */
export declare class AxonRemoteError extends AxonError {
    constructor(message: string, cause?: unknown);
}

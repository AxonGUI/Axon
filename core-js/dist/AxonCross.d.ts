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
export declare const AxonCross: {
    /** 现在还活着的窗口名。 */
    windows(): Promise<string[]>;
    /** 这个窗口还在不在。 */
    has(web: string): Promise<boolean>;
    /**
     * 直接调另一个窗口，写法跟 `Axon.xxx` 一样：
     * `AxonCross.web("charts").Charts.reload("600s")`
     */
    web(web: string): Record<string, Record<string, AxonCrossCallArgs>>;
    /** 调另一个窗口里的一个方法，参数/超时写法同 `Axon`。 */
    call({ web, controller, func, args, kwargs, timeout }: AxonCrossCallOptions): Promise<any>;
    /** 一次打到所有窗口，返回每个窗口自己的结果。 */
    broadcast({ controller, func, args, kwargs, timeout, exclude, }: AxonCrossBroadcastOptions): Promise<AxonCrossResult[]>;
    /** 发一个事件给所有窗口（对方用 `AxonEvent.addListener(type, fn)` 接）。 */
    emit(type: string, ...args: any[]): Promise<{
        count: number;
    }>;
    /** 发一个事件给指定窗口。 */
    emitTo(web: string, type: string, ...args: any[]): Promise<any>;
};

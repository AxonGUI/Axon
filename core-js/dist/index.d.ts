declare type AddEventListenerOptions_2 = {
    once: boolean;
};
export { AddEventListenerOptions_2 as AddEventListenerOptions }

/**
 * Axon 的 JS 侧语法糖。
 *
 * ```ts
 * await Axon.Users.add(1, 2)          // 调 Python 方法, 位置参数直接摊开
 * await Axon.Users.slow([1000], {}, 300)  // 需要 kwargs / 超时时用打包写法
 * await Axon.Users.count              // 读 Python 属性 (getVar)
 * Axon.Users.count = 3                // 写 Python 属性 (setVar, fire-and-forget)
 * ```
 *
 * 属性读是惰性的: 只有真正 `await` / `.then` / `.catch` / `.finally` 时才发请求。
 * 取到的 `dispatcher` 本身是函数, 同时挂了 `then/catch/finally`,
 * 让 `Axon.Users.count` 既能当 Promise 用, 又能当方法调用。
 */
export declare const Axon: AxonProxy;

export declare const AxonCall: {
    init(): Promise<void>;
    __call__<K extends SmartPYControllerName, F extends SmartPYControllerPropName<K>>({ controller_id, prop, args, kwargs, timeout, type, }: {
        controller_id: K;
        prop: F;
        args?: any[];
        kwargs?: { [key in string]: any; };
        timeout?: number;
        type: JSCallType;
    }): Promise<any>;
    call<K extends SmartPYControllerName, F extends SmartPYControllerPropName<K>>(data: {
        controller_id: K;
        func: F;
        args?: any[];
        kwargs?: { [key in string]: any; };
        timeout?: number;
    }): Promise<any>;
    setVar<K extends SmartPYControllerName, F extends SmartPYControllerPropName<K>>({ controller_id, var_name, value, timeout, }: {
        controller_id: K;
        var_name: F;
        value: any;
        timeout?: number;
    }): Promise<any>;
    getVar<K extends SmartPYControllerName, F extends SmartPYControllerPropName<K>>({ controller_id, var_name, timeout, }: {
        controller_id: K;
        var_name: F;
        timeout?: number;
    }): Promise<any>;
    crossCall(data: {
        web_name: string;
        controller_id: string;
        func: string;
        args?: any[];
        timeout?: number;
    }): Promise<any>;
    returnReceiver([call_id, state, data]: JSRetData): void;
};

/** 调用 Python 方法时可以用的两种写法。 */
export declare type AxonCallArgs = {
    /** 打包式: `fn([a, b], { kwarg: 1 }, 3000)` —— 需要 kwargs / timeout 时用这个 */
    (args?: any[], kwargs?: Record<string, any>, timeout?: number): Promise<any>;
    /** 摊开式: `fn(a, b, c)` —— 等价于 `fn([a, b, c])`; 要传单个数组参数请写 `fn([[1, 2]])` */
    (...args: any[]): Promise<any>;
};

export declare const AxonChannels: IAxonChannels;

export declare let AxonChannelStatus: IAxonChannelStatus;

export declare const AxonController: _AxonController;

declare type _AxonController = {
    (id?: ControllerId): <T extends {
        new (): any;
    }>(controller: T) => T;
    get(controller_id: ControllerId): any;
    register(id: string, controller: any): void;
    unregister(controller_id: ControllerId): void;
};

declare type AxonControllerProxy<K extends SmartPYControllerName> = {
    [P in SmartPYControllerPropName<K>]: AxonCallArgs & Promise<any>;
};

export declare const AxonEvent: {
    __listeners: EventListeners;
    __onceEventListenerMap: OnceEventListenerMap;
    on: <K extends keyof AxonEventMap>(type: K, listener: AxonEventMap[K], options?: AddEventListenerOptions_2) => void;
    off: <K extends keyof AxonEventMap>(type: K, listener: AxonEventMap[K]) => void;
    addListener<K extends keyof AxonEventMap>(type: K, listener: AxonEventMap[K], options?: AddEventListenerOptions_2): void;
    removeListener<K extends keyof AxonEventMap>(type: K, listener: AxonEventMap[K]): void;
    removeAllListeners<K extends keyof AxonEventMap>(type: K): void;
    dispatchEvent<K extends keyof AxonEventMap>(type: K, ...args: Parameters<AxonEventMap[K]>): void;
    dispatchPYEvent({ type, args, kwargs, }: {
        type: string;
        args?: any[];
        kwargs?: Record<string, any>;
    }): Promise<any>;
};

export declare interface AxonEventMap extends AxonQtEventMap {
}

/**
 * 初始化 Axon JS 侧。
 *
 * 返回状态而不是抛错: 普通浏览器里调用会得到 `{connected:false, ready:false}`,
 * 页面可以据此退化成纯静态说明书。
 */
export declare function AxonInit(): Promise<IAxonInitResult>;

declare type AxonProxy = {
    [K in SmartPYControllerName]: AxonControllerProxy<K>;
};

export declare interface AxonPYController {
    AxonCrossCallHandler: {
        onCall: any;
    };
    PYAxonStoreSyncManager: {
        createStore: any;
        deleteStore: any;
    };
}

export declare interface AxonQtEventMap {
    loadFinished: () => any;
    contextMenu: (e: {
        reason: Reason;
        globalPos: {
            x: number;
            y: number;
        };
        pos: {
            x: number;
            y: number;
        };
    }) => any;
    dragEnter: (e: QDropEvent) => any;
    dragMove: (e: QDropEvent) => any;
    drop: (e: QDropEvent) => any;
    dragLeave: () => any;
    hide: () => any;
    show: () => any;
}

export declare class AxonStore {
    static AxonStoreMap: Map<string, AxonStore>;
    static shared: AxonStore;
    id: string;
    store: Map<string, AxonStoreProperty>;
    controller_id: string;
    static init(): void;
    constructor(id: string, auto_create?: boolean);
    prop(name: string, value?: any): AxonStoreProperty;
    /** 读一个键: `store.get("k")` 等价于 `store.prop("k")`。 */
    get(prop: string): AxonStoreProperty;
    /** 写一个键: `store.set("k", 1)` 等价于 `store.prop("k").set(1)`。 */
    set(prop: string, value: any): void;
    /** 由 Python 侧写入, 只更新本地值。 */
    setFromPeer(prop: string, value: any): void;
    release(): void;
    _release(): void;
}

/**
 * store 里的一个键值。
 *
 * 两端同名: `get()` 读、`set(value)` 写、`setFromPeer(value)` 接收对端写入
 * （对端写进来时不回推, 避免两端来回弹）。
 */
declare class AxonStoreProperty {
    name: string;
    value: any;
    store: AxonStore;
    constructor(name: string, value: any, store: AxonStore);
    get(): any;
    set(value: any): void;
    /** 由 Python 侧写入（Python 调这个）, 只更新本地值, 不再回推。 */
    setFromPeer(value: any): void;
}

declare type CallId = string;

declare type ControllerId = string;

export declare enum DropAction {
    IgnoreAction = 0,
    CopyAction = 1,
    MoveAction = 2,
    LinkAction = 4,
    ActionMask = 255,
    TargetMoveAction = 32770
}

declare type EventListeners = Partial<{
    [K in keyof AxonEventMap]: Set<AxonEventMap[K]>;
}>;

/** 通道连接的当前状态 —— 供「检测到 Python 后台」这类双模式页面判断。 */
export declare interface IAxonChannelStatus {
    /** 是否真的连上了 QWebChannel */
    connected: boolean;
    /** 失败原因: 没有 qt 传输对象 / 重试耗尽 */
    reason?: "no-qt-transport" | "retry-exhausted";
    /** 后端注册的对象名, 例如 ["AxonEnv", "AxonJSCallHandler", "AxonPYCall"] */
    objects: string[];
    error?: string;
}

/** AxonInit 的返回值 —— 前端据此决定"交互模式"还是"纯文档模式"。 */
export declare interface IAxonInitResult {
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
 * 初始化 QWebChannel。
 *
 * 与旧版不同: 失败不再抛异常, 而是返回状态对象。这样同一份前端代码可以
 * 既跑在 AxonGUI 里（有 window.qt.webChannelTransport）, 也跑在普通浏览器里
 * （当作纯静态文档）。
 */
export declare function initChannels(): Promise<IAxonChannelStatus>;

/** 是否已连上 Python 后台（同步查询, 需在 initChannels/AxonInit 之后调用）。 */
export declare function isAxonConnected(): boolean;

/** 同步查询是否已就绪。 */
export declare function isAxonReady(): boolean;

declare type JSCallType = "call" | "set" | "get";

declare type JSRetData = [CallId, "resolve" | "reject", any];

export declare enum KeyboardModifier {
    KeyboardModifierMask = -33554432,
    NoModifier = 0,
    ShiftModifier = 33554432,
    ControlModifier = 67108864,
    AltModifier = 134217728,
    MetaModifier = 268435456,
    KeypadModifier = 536870912,
    GroupSwitchModifier = 1073741824
}

export declare enum MouseButton {
    MouseButtonMask = -1,
    NoButton = 0,
    LeftButton = 1,
    RightButton = 2,
    MiddleButton = 4,
    BackButton = 8,
    ExtraButton1 = 8,
    XButton1 = 8,
    ExtraButton2 = 16,
    ForwardButton = 16,
    XButton2 = 16,
    ExtraButton3 = 32,
    TaskButton = 32,
    ExtraButton4 = 64,
    ExtraButton5 = 128,
    ExtraButton6 = 256,
    ExtraButton7 = 512,
    ExtraButton8 = 1024,
    ExtraButton9 = 2048,
    ExtraButton10 = 4096,
    ExtraButton11 = 8192,
    ExtraButton12 = 16384,
    ExtraButton13 = 32768,
    ExtraButton14 = 65536,
    ExtraButton15 = 131072,
    ExtraButton16 = 262144,
    ExtraButton17 = 524288,
    ExtraButton18 = 1048576,
    ExtraButton19 = 2097152,
    ExtraButton20 = 4194304,
    ExtraButton21 = 8388608,
    ExtraButton22 = 16777216,
    ExtraButton23 = 33554432,
    ExtraButton24 = 67108864,
    MaxMouseButton = 67108864,
    AllButtons = 134217727
}

declare type OnceEventListenerMap = Partial<{
    [K in keyof AxonEventMap]: Map<AxonEventMap[K], AxonEventMap[K]>;
}>;

/**
 * 把「摊开式」和「打包式」两种调用统一成 AxonCall.call 的参数。
 *
 * - 第一个参数是数组 → 老式打包写法, 后面两个位置分别是 kwargs / timeout
 * - 否则 → 所有位置参数就是 Python 方法的位置参数
 */
export declare function packCallArgs(callArgs: any[]): PackedCall;

declare type PackedCall = {
    args?: any[];
    kwargs?: Record<string, any>;
    timeout?: number;
};

export declare type PYControllerFuncName<K extends PYControllerName> = keyof AxonPYController[K];

export declare type PYControllerName = keyof AxonPYController;

export declare type QDropEvent = {
    mimeData: {
        urls: string[];
        text: string;
        html: string;
        formats: string[];
    };
    pos: {
        x: number;
        y: number;
    };
    posF: {
        x: number;
        y: number;
    };
    modifiers: KeyboardModifier;
    keyboardModifiers: KeyboardModifier;
    buttons: MouseButton;
    mouseButtons: MouseButton;
    dropAction: DropAction;
    possibleActions: DropAction;
    proposedAction: DropAction;
};

export declare enum Reason {
    Mouse = 0,
    Keyboard = 1,
    Other = 2
}

export declare type SmartPYControllerName = PYControllerName | (string & {});

export declare type SmartPYControllerPropName<K extends SmartPYControllerName> = K extends PYControllerName ? PYControllerFuncName<K> : string;

export { }


declare module "./AxonChannel" {
    interface IAxonChannels {
        AxonJSCallHandler: AxonJSCallHandler;
    }
}


declare module "./AxonChannel" {
    interface IAxonChannels {
        AxonPYCall: AxonPYCall;
    }
}

declare global {
    interface Window {
        qt: any;
    }
}

declare global {
    interface Window {
        qt: any;
    }
}


declare module "qwebchannel/qwebchannel.js" {
    export const enum QWebChannelMessageTypes {
        signal = 1,
        propertyUpdate = 2,
        init = 3,
        idle = 4,
        debug = 5,
        invokeMethod = 6,
        connectToSignal = 7,
        disconnectFromSignal = 8,
        setProperty = 9,
        response = 10,
    }
    export type QWebChannelTransport = { webChannelTransport: any };
    export class QWebChannel {
        objects: any;
        constructor(
            transport: WebSocket,
            initCallback: (channel: QWebChannel) => void,
        );
        send(data: any): void;
        exec(data: any, callback: (data: any) => void): void;
        handleSignal(message: MessageEvent): void;
        handleResponse(message: MessageEvent): void;
        handlePropertyUpdate(message: MessageEvent): void;
    }
}


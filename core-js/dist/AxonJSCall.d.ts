import { SignalInstance } from './types.js';

type CallId = string;
export interface AxonPYController {
    AxonCrossCallHandler: {
        onCall: any;
    };
    PYAxonStoreSyncManager: {
        createStore: any;
        deleteStore: any;
    };
}
export type PYControllerName = keyof AxonPYController;
export type SmartPYControllerName = PYControllerName | (string & {});
export type PYControllerFuncName<K extends PYControllerName> = keyof AxonPYController[K];
export type SmartPYControllerPropName<K extends SmartPYControllerName> = K extends PYControllerName ? PYControllerFuncName<K> : string;
type JSCallType = "call" | "set" | "get";
type JSData<K extends SmartPYControllerName, F extends SmartPYControllerPropName<K>> = {
    call_id: CallId;
    web_name: string;
    controller_id: K;
    prop: F;
    args: any[];
    kwargs: Record<string, any>;
    type: JSCallType;
};
type JSRetData = [CallId, "resolve" | "reject", any];
interface AxonJSCallHandler {
    returnReceiverSignal: SignalInstance<[JSRetData]>;
    returnReceiverBatchSignal?: SignalInstance<[JSRetData[]]>;
    onCall: <K extends SmartPYControllerName, F extends SmartPYControllerPropName<K>>(data: JSData<K, F>) => void;
}
declare module "./AxonChannel" {
    interface IAxonChannels {
        AxonJSCallHandler: AxonJSCallHandler;
    }
}
export declare const AxonCall: {
    init(): Promise<void>;
    __call__<K extends SmartPYControllerName, F extends SmartPYControllerPropName<K>, T = unknown>({ controller_id, prop, args, kwargs, timeout, type, }: {
        controller_id: K;
        prop: F;
        args?: any[];
        kwargs?: { [key in string]: any; };
        timeout?: number;
        type: JSCallType;
    }): Promise<T>;
    /** 调 Python 控制器的方法；返回类型可以自己指定：`await AxonCall.call<number>({...})`。 */
    call<T = unknown, K extends SmartPYControllerName = SmartPYControllerName, F extends SmartPYControllerPropName<K> = SmartPYControllerPropName<K>>(data: {
        controller_id: K;
        func: F;
        args?: any[];
        kwargs?: { [key in string]: any; };
        timeout?: number;
    }): Promise<T>;
    setVar<K extends SmartPYControllerName, F extends SmartPYControllerPropName<K>>({ controller_id, var_name, value, timeout, }: {
        controller_id: K;
        var_name: F;
        value: any;
        timeout?: number;
    }): Promise<unknown>;
    getVar<T = unknown, K extends SmartPYControllerName = SmartPYControllerName, F extends SmartPYControllerPropName<K> = SmartPYControllerPropName<K>>({ controller_id, var_name, timeout, }: {
        controller_id: K;
        var_name: F;
        timeout?: number;
    }): Promise<T>;
    crossCall<T = unknown>(data: {
        web_name?: string;
        controller_id: string;
        func?: string;
        args?: any[];
        kwargs?: Record<string, any>;
        timeout?: number;
        action?: "call" | "broadcast" | "windows" | "emit";
        exclude?: string[];
        type?: string;
    }): Promise<T>;
    returnReceiverBatch(items: JSRetData[]): void;
    returnReceiverDecoded([call_id, state, data]: JSRetData): Promise<void>;
    returnReceiver([call_id, state, data]: JSRetData): void;
};
export {};

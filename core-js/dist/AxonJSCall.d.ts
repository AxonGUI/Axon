import { SignalInstance } from './types.ts';

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
        web_name?: string;
        controller_id: string;
        func?: string;
        args?: any[];
        kwargs?: Record<string, any>;
        timeout?: number;
        action?: "call" | "broadcast" | "windows" | "emit";
        exclude?: string[];
        type?: string;
    }): Promise<any>;
    returnReceiverBatch(items: JSRetData[]): void;
    returnReceiverDecoded([call_id, state, data]: JSRetData): Promise<void>;
    returnReceiver([call_id, state, data]: JSRetData): void;
};
export {};

import { SignalInstance } from './types.js';
type ControllerId = string;
type ControllerPropName = string;
export type _AxonController = {
    (id?: ControllerId): <T extends {
        new (): any;
    }>(controller: T) => T;
    get(controller_id: ControllerId): any;
    register(id: string, controller: any): void;
    unregister(controller_id: ControllerId): void;
};
export declare const AxonController: _AxonController;
type CallId = string;
type PYControllerData = {
    call_id: CallId;
    controller_id: ControllerId;
    prop: ControllerPropName;
    args: any[];
    kwargs?: Record<string, any>;
    type: "call" | "set" | "get";
};
export type JSRetData = {
    call_id: CallId;
    state: "resolve" | "reject";
    data: any;
};
type AxonPYCall = {
    onCallSignal: SignalInstance<[PYControllerData]>;
    hasControllerSignal: any;
    returnReceiver: (retData: JSRetData) => void;
};
declare module "./AxonChannel" {
    interface IAxonChannels {
        AxonPYCall: AxonPYCall;
    }
}
export declare const AxonPYCallHandler: {
    init(): Promise<void>;
    callback(retData: JSRetData): void;
    hasController({ call_id, controller_id, }: {
        call_id: CallId;
        controller_id: ControllerId;
    }): void;
    onCall(data: PYControllerData): Promise<void>;
};
export {};

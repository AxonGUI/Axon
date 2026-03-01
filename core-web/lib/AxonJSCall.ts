import { v4 as uuid_v4 } from "uuid";
import { AxonChannels } from "./AxonChannel.ts";
import { SignalInstance } from "./types.ts";
type CallId = string;
const _callbacks = {} as {
  [key in CallId]: {
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
  };
};
export interface PYController {
  AxonCrossCallHandler: {
    onCall: {
      // TODO : 这里的 any 可以进一步细化
      args: [any];
    };
  };
}
type PYControllerName = keyof PYController;
type SmartPYControllerName = PYControllerName | (string & {});
type SmartPYControllerFuncName<K extends SmartPYControllerName> =
  K extends PYControllerName ? keyof PYController[K] : string;
type JSCallType = "call" | "set" | "get";
type JSData<
  K extends SmartPYControllerName,
  F extends SmartPYControllerFuncName<K>,
> = {
  call_id: CallId;
  web_name: string;
  controller_id: K;
  attr: F;
  args: any[];
  kwargs: Record<string, any>;
  type: JSCallType;
};
type JSRetData = [CallId, "resolve" | "reject", any];
interface AxonJSCallHandler {
  returnReceiverSignal: SignalInstance<[JSRetData]>;
  onCall: <
    K extends SmartPYControllerName,
    F extends SmartPYControllerFuncName<K>,
  >(
    data: JSData<K, F>,
  ) => void;
}
declare module "./AxonChannel" {
  interface IAxonChannels {
    AxonJSCallHandler: AxonJSCallHandler;
  }
}
export const AxonCall = {
  async init() {
    const channel = AxonChannels.AxonJSCallHandler;
    try {
      channel.returnReceiverSignal.disconnect(AxonCall.returnReceiver);
    } catch {}
    channel.returnReceiverSignal.connect(AxonCall.returnReceiver);
  },
  __call__<
    K extends SmartPYControllerName,
    F extends SmartPYControllerFuncName<K>,
  >({
    controller_id,
    attr,
    args = [],
    kwargs = {},
    timeout,
    type = "call",
  }: {
    controller_id: K;
    attr: F;
    args?: any[];
    kwargs?: { [key in string]: any };
    timeout?: number;
    type: JSCallType;
  }) {
    return new Promise<any>((resolve, reject) => {
      const call_id = uuid_v4();
      if (timeout !== undefined) {
        let timeout_timer: number | undefined;
        _callbacks[call_id] = {
          resolve: (res) => {
            clearTimeout(timeout_timer);
            resolve(res);
          },
          reject: (res) => {
            clearTimeout(timeout_timer);
            reject(res);
          },
        };
        timeout_timer = setTimeout(
          () =>
            AxonCall.returnReceiver([
              call_id,
              "reject",
              `Timeout Error, py not return in ${timeout}ms`,
            ]),
          timeout,
        );
      } else _callbacks[call_id] = { resolve, reject };
      AxonChannels.AxonJSCallHandler.onCall({
        call_id,
        web_name: AxonChannels.AxonEnv.web_name,
        controller_id,
        attr,
        args,
        kwargs,
        type,
      });
    });
  },
  call<
    K extends SmartPYControllerName,
    F extends SmartPYControllerFuncName<K>,
  >(data: {
    controller_id: K;
    func: F;
    args?: any[];
    kwargs?: { [key in string]: any };
    timeout?: number;
  }) {
    return AxonCall.__call__({ ...data, type: "call", attr: data.func });
  },
  setVar<
    K extends SmartPYControllerName,
    F extends SmartPYControllerFuncName<K>,
  >({
    controller_id,
    var_name,
    value,
    timeout,
  }: {
    controller_id: K;
    var_name: F;
    value: any;
    timeout?: number;
  }) {
    return AxonCall.__call__({
      controller_id,
      type: "set",
      args: [value],
      attr: var_name,
      timeout,
    });
  },
  getVar<
    K extends SmartPYControllerName,
    F extends SmartPYControllerFuncName<K>,
  >({
    controller_id,
    var_name,
    timeout,
  }: {
    controller_id: K;
    var_name: F;
    value: any;
    timeout?: number;
  }) {
    return AxonCall.__call__({
      controller_id,
      type: "get",
      attr: var_name,
      timeout,
    });
  },
  crossCall(data: {
    web_name: string;
    controller_id: string;
    func: string;
    args?: any[];
    timeout?: number;
  }) {
    const { timeout, ...payload } = data;
    return AxonCall.call({
      controller_id: "AxonCrossCallHandler",
      func: "onCall",
      args: [payload],
      timeout: timeout,
    });
  },
  returnReceiver([call_id, state, data]: JSRetData) {
    const callback = _callbacks[call_id];
    if (callback) {
      delete _callbacks[call_id];
      callback[state](data);
    }
  },
};

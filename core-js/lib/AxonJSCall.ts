import { v4 as uuid_v4 } from "uuid";
import { AxonChannels } from "./AxonChannel.ts";
import {
  AxonError,
  AxonNotConnectedError,
  AxonRemoteError,
  AxonTimeoutError,
} from "./AxonError.ts";
import { decode as codecDecode, encode as codecEncode } from "./AxonCodec.ts";
import { SignalInstance } from "./types.ts";
type CallId = string;
const _callbacks = {} as {
  [key in CallId]: {
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
  };
};
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
export type PYControllerFuncName<K extends PYControllerName> =
  keyof AxonPYController[K];
export type SmartPYControllerPropName<K extends SmartPYControllerName> =
  K extends PYControllerName ? PYControllerFuncName<K> : string;
type JSCallType = "call" | "set" | "get";
type JSData<
  K extends SmartPYControllerName,
  F extends SmartPYControllerPropName<K>,
> = {
  call_id: CallId;
  web_name: string;
  controller_id: K;
  prop: F;
  args: any[];
  kwargs: Record<string, any>;
  type: JSCallType;
};
type JSRetData = [CallId, "resolve" | "reject", any];

// 同一轮事件循环里发出的调用先排队，flush 时合并成一条消息发过去。
// 对外接口不变：每个调用仍然各自 resolve / reject。
const _outbox: any[] = [];
let _codecEnabled = false;
let _outboxFlushScheduled = false;

function scheduleOutboxFlush() {
  if (_outboxFlushScheduled) return;
  _outboxFlushScheduled = true;
  const flush = () => {
    _outboxFlushScheduled = false;
    if (_outbox.length === 0) return;
    const handler: any = (AxonChannels as any).AxonJSCallHandler;
    if (!handler) {
      _outbox.length = 0;
      return;
    }
    const queued = _outbox.splice(0, _outbox.length);
    // 压缩是异步的（CompressionStream），等载荷准备好再一起发
    Promise.all(
      queued.map(async (item: any) => {
        if (!item.payload) return item;
        const packed = await item.payload;
        delete item.payload;
        return { ...item, args: packed.args, kwargs: packed.kwargs };
      })
    ).then((batch: any[]) => {
      if (batch.length === 0) return;
      if (batch.length === 1) handler.onCall(batch[0]);
      else handler.onCall({ batch });
    });
  };
  if (typeof queueMicrotask === "function") queueMicrotask(flush);
  else Promise.resolve().then(flush);
}
interface AxonJSCallHandler {
  returnReceiverSignal: SignalInstance<[JSRetData]>;
  returnReceiverBatchSignal?: SignalInstance<[JSRetData[]]>;
  onCall: <
    K extends SmartPYControllerName,
    F extends SmartPYControllerPropName<K>,
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
    channel.returnReceiverSignal.connect(AxonCall.returnReceiverDecoded);
    try {
      const env: any = (AxonChannels as any).AxonEnv;
      // 后端声明支持压缩才启用；老后端没有这个属性，保持关闭
      if (env && env.supports_codec) {
        _codecEnabled = true;
        if (typeof env.codec === "function") env.codec(true);
      }
    } catch (e) {
      _codecEnabled = false;
    }
    try {
      const batchSignal = (channel as any).returnReceiverBatchSignal;
      if (batchSignal) batchSignal.connect(AxonCall.returnReceiverBatch);
    } catch {}
  },
  __call__<
    K extends SmartPYControllerName,
    F extends SmartPYControllerPropName<K>,
    T = unknown,
  >({
    controller_id,
    prop,
    args = [],
    kwargs = {},
    timeout,
    type = "call",
  }: {
    controller_id: K;
    prop: F;
    args?: any[];
    kwargs?: { [key in string]: any };
    timeout?: number;
    type: JSCallType;
  }): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const call_id = uuid_v4();
      if (timeout !== undefined) {
        let timeout_timer: any | undefined;
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
              new AxonTimeoutError(`Python 没有在 ${timeout}ms 内返回`),
            ]),
          timeout,
        );
      } else _callbacks[call_id] = { resolve, reject };
      if (!(AxonChannels as any).AxonJSCallHandler) {
        // 通道没连上时立刻 reject，不把调用挂在队列里
        delete _callbacks[call_id];
        reject(new AxonNotConnectedError());
        return;
      }
      const payload = _codecEnabled
        ? Promise.all([codecEncode(args), codecEncode(kwargs)]).then(([a, k]) => ({
            args: a,
            kwargs: k,
          }))
        : null;
      _outbox.push({
        call_id,
        web_name: AxonChannels.AxonEnv.web_name,
        controller_id,
        prop,
        args,
        kwargs,
        type,
        payload,
      });
      scheduleOutboxFlush();
    });
  },
  /** 调 Python 控制器的方法；返回类型可以自己指定：`await AxonCall.call<number>({...})`。 */
  call<
    T = unknown,
    K extends SmartPYControllerName = SmartPYControllerName,
    F extends SmartPYControllerPropName<K> = SmartPYControllerPropName<K>,
  >(data: {
    controller_id: K;
    func: F;
    args?: any[];
    kwargs?: { [key in string]: any };
    timeout?: number;
  }): Promise<T> {
    return AxonCall.__call__<K, F, T>({ ...data, type: "call", prop: data.func });
  },
  setVar<
    K extends SmartPYControllerName,
    F extends SmartPYControllerPropName<K>,
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
      prop: var_name,
      timeout,
    });
  },
  getVar<
    T = unknown,
    K extends SmartPYControllerName = SmartPYControllerName,
    F extends SmartPYControllerPropName<K> = SmartPYControllerPropName<K>,
  >({
    controller_id,
    var_name,
    timeout,
  }: {
    controller_id: K;
    var_name: F;
    timeout?: number;
  }): Promise<T> {
    return AxonCall.__call__<K, F, T>({
      controller_id,
      type: "get",
      prop: var_name,
      timeout,
    });
  },
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
  }): Promise<T> {
    const { timeout, ...payload } = data;
    return AxonCall.call<T>({
      controller_id: "AxonCrossCallHandler",
      func: "onCall",
      args: [payload],
      timeout: timeout,
    });
  },
  returnReceiverBatch(items: JSRetData[]) {
    for (const item of items) void AxonCall.returnReceiverDecoded(item);
  },
  async returnReceiverDecoded([call_id, state, data]: JSRetData) {
    let value = data;
    if (_codecEnabled && state === "resolve") {
      try {
        value = await codecDecode(data);
      } catch (e) {
        value = data;
      }
    }
    AxonCall.returnReceiver([call_id, state, value]);
  },
  returnReceiver([call_id, state, data]: JSRetData) {
    const callback = _callbacks[call_id];
    if (!callback) return;
    delete _callbacks[call_id];
    if (state === "reject") {
      // Python 侧只送得回来字符串，包成 Error，catch 里才有 message/stack
      const error =
        data instanceof AxonError
          ? data
          : new AxonRemoteError(
              typeof data === "string" ? data : JSON.stringify(data ?? "远程调用失败"),
            );
      callback.reject(error);
      return;
    }
    callback.resolve(data);
  },
};

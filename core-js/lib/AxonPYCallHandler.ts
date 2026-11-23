import { AxonChannels } from "./AxonChannel";
import { SignalInstance } from "./types";
type ControllerId = string;
type ControllerPropName = string;
const controllers: { [key in ControllerId]: any } = {};
export type _AxonController = {
  (id?: ControllerId): <T extends { new (): any }>(controller: T) => T;
  get(controller_id: ControllerId): any;
  register(id: string, controller: any): void;
  unregister(controller_id: ControllerId): void;
};
export const AxonController = <_AxonController>function (id?: ControllerId) {
  return <T extends { new (): any }>(controller: T) => {
    // 注意: 不能写 `id = controller.name`，那会改写外层闭包里的 id,
    // 导致第二个 `@AxonController()` 复用了第一个类名。
    const controllerId = id !== undefined ? id : controller.name;
    controllers[controllerId] = new controller();
    return controller;
  };
};
AxonController.get = (controller_id) => {
  const controller = controllers[controller_id];
  if (!controller)
    throw `[AxonController Error] Controller "${controller_id}" not found`;
  return controller;
};
AxonController.register = (id, controller) => {
  controllers[id] = controller;
};
AxonController.unregister = (controller_id) => {
  delete controllers[controller_id];
};
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
export const AxonPYCallHandler = {
  async init() {
    const channel = AxonChannels.AxonPYCall;
    if (!channel) throw new Error("[AxonPYCallHandler] AxonPYCall channel missing");
    try {
      channel.onCallSignal.disconnect(AxonPYCallHandler.onCall);
    } catch {}
    channel.onCallSignal.connect(AxonPYCallHandler.onCall);
    try {
      channel.hasControllerSignal.disconnect(AxonPYCallHandler.hasController);
    } catch {}
    channel.hasControllerSignal.connect(AxonPYCallHandler.hasController);
  },
  callback(retData: JSRetData) {
    AxonChannels.AxonPYCall.returnReceiver(retData);
  },
  hasController({
    call_id,
    controller_id,
  }: {
    call_id: CallId;
    controller_id: ControllerId;
  }) {
    try {
      AxonController.get(controller_id);
      AxonPYCallHandler.callback({
        call_id: call_id,
        state: "resolve",
        data: true,
      });
    } catch (error) {
      AxonPYCallHandler.callback({
        call_id: call_id,
        state: "resolve",
        data: false,
      });
    }
  },
  async onCall(data: PYControllerData) {
    try {
      const controller = AxonController.get(data.controller_id);
      if (data.type === "set") {
        controller[data.prop] = data.args[0];
        AxonPYCallHandler.callback({
          call_id: data.call_id,
          state: "resolve",
          data: null,
        });
        return;
      }
      const prop = controller[data.prop];
      if (data.type === "get") {
        AxonPYCallHandler.callback({
          call_id: data.call_id,
          state: "resolve",
          data: prop,
        });
        return;
      }
      // kwargs 的约定: 非空时作为「最后一个对象参数」传入。
      // JS 函数拿不到关键字参数, 这是跨语言唯一可行的折中。
      const kwargs = data.kwargs || {};
      const callArgs = Object.keys(kwargs).length
        ? [...data.args, kwargs]
        : data.args;
      const ret = await prop.apply(controller, callArgs);
      AxonPYCallHandler.callback({
        call_id: data.call_id,
        state: "resolve",
        data: ret,
      });
    } catch (err: any) {
      AxonPYCallHandler.callback({
        call_id: data.call_id,
        state: "reject",
        data: String(err),
      });
    }
  },
};

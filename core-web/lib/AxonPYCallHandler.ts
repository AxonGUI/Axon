import { AxonChannels } from "./AxonChannel";
import { SignalInstance } from "./types";
type ControllerId = string;
type ControllerFuncName = string;
const controllers: { [key in ControllerId]: any } = {};
export type _AxonController = {
  (id?: ControllerId): <T extends { new (): any }>(controller: T) => T;
  get(controller_id: ControllerId): any;
  register(id: ControllerId, controller: any): void;
  unregister(controller_id: ControllerId): void;
};
export const AxonController = <_AxonController>function (id?: ControllerId) {
  return <T extends { new (): any }>(controller: T) => {
    if (id === undefined) id = controller.name;
    controllers[id] = new controller();
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
  func_name: ControllerFuncName;
  args: any[];
};
export type JSRetData = {
  call_id: CallId;
  state: "resolve" | "reject";
  data: any;
};
export type AxonPYCall = {
  onCallSignal: SignalInstance<[PYControllerData]>;
  hasControllerSignal: any;
  returnReceiver: (retData: JSRetData) => void;
};
export const AxonPYCallHandler = {
  async init() {
    const channel = AxonChannels.AxonPYCall;
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
      const func = controller[data.func_name];
      const ret = await func.apply(controller, data.args);
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
      throw err;
    }
  },
};

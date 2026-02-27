import { AxonGUI } from "./AxonGUI";
type ControllerId = string;
type ControllerFuncName = string;
const controllers: { [key in ControllerId]: any } = {};
export type _AxonController = {
    (id?: ControllerId): <T extends { new(): any }>(controller: T) => T;
    get(controller_id: ControllerId): any;
    register(id: ControllerId, controller: any): void;
    unregister(controller_id: ControllerId): void;
};
export const AxonController = <_AxonController>function (id?: ControllerId) {
    return <T extends { new(): any }>(controller: T) => {
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
export const AxonCallHandler = {
    init() {
        const channel = AxonGUI.py_channels["AxonCall"];
        try {
            channel.onCallSignal.disconnect(AxonCallHandler.onCall);
        } catch { }
        channel.onCallSignal.connect(AxonCallHandler.onCall);
        try {
            channel.hasControllerSignal.disconnect(AxonCallHandler.hasController);
        } catch { }
        channel.hasControllerSignal.connect(AxonCallHandler.hasController);
    },
    callback(retData: {
        call_id: CallId;
        state: "resolve" | "reject";
        data: any;
    }) {
        AxonGUI.py_channels["AxonCall"]["returnReceiver"](retData);
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
            AxonCallHandler.callback({
                call_id: call_id,
                state: "resolve",
                data: true,
            });
        } catch (error) {
            AxonCallHandler.callback({
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
            AxonCallHandler.callback({
                call_id: data.call_id,
                state: "resolve",
                data: ret,
            });
        } catch (err: any) {
            AxonCallHandler.callback({
                call_id: data.call_id,
                state: "reject",
                data: String(err),
            });
            throw err;
        }
    },
};

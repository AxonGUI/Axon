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
type PostId = string;
type PYControllerData = {
    post_id: PostId;
    controller_id: ControllerId;
    func_name: ControllerFuncName;
    args: any[];
};
export const AxonPostHandler = {
    init() {
        const channel = AxonGUI.py_channels["AxonPost"];
        try {
            channel.onPostSignal.disconnect(AxonPostHandler.onPost);
        } catch { }
        channel.onPostSignal.connect(AxonPostHandler.onPost);
        try {
            channel.hasControllerSignal.disconnect(AxonPostHandler.hasController);
        } catch { }
        channel.hasControllerSignal.connect(AxonPostHandler.hasController);
    },
    callback(retData: {
        post_id: PostId;
        state: "resolve" | "reject";
        data: any;
    }) {
        AxonGUI.py_channels["AxonPost"]["responseReceiver"](retData);
    },
    hasController({
        post_id,
        controller_id,
    }: {
        post_id: PostId;
        controller_id: ControllerId;
    }) {
        try {
            AxonController.get(controller_id);
            AxonPostHandler.callback({
                post_id: post_id,
                state: "resolve",
                data: true,
            });
        } catch (error) {
            AxonPostHandler.callback({
                post_id: post_id,
                state: "resolve",
                data: false,
            });
        }
    },
    async onPost(data: PYControllerData) {
        try {
            const controller = AxonController.get(data.controller_id);
            const func = controller[data.func_name];
            const ret = await func.apply(controller, data.args);
            AxonPostHandler.callback({
                post_id: data.post_id,
                state: "resolve",
                data: ret,
            });
        } catch (err: any) {
            AxonPostHandler.callback({
                post_id: data.post_id,
                state: "reject",
                data: String(err),
            });
            throw err;
        }
    },
};

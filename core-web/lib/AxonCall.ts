import { v4 as uuid_v4 } from "uuid";
import { AxonGUI } from "./AxonGUI.ts";
type CallId = string;
const _callbacks = {} as {
    [key in CallId]: {
        resolve: (value: any) => void;
        reject: (reason?: any) => void;
    };
};
export const AxonCall = {
    init() {
        const channel = AxonGUI.py_channels["AxonCallHandler"];
        try {
            channel.returnReceiverSignal.disconnect(AxonCall.returnReceiver);
        } catch { }
        channel.returnReceiverSignal.connect(AxonCall.returnReceiver);
    },
    call({
        controller_id,
        func,
        args = [],
        kwargs = {},
        timeout,
    }: {
        controller_id: string;
        func: string;
        args?: any[];
        kwargs?: { [key in string]: any };
        timeout?: number;
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
            AxonGUI.py_channels["AxonCallHandler"]["onCall"]({
                call_id,
                web_name: window.AxonEnv.web_name,
                controller_id,
                func,
                args,
                kwargs,
            });
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
    returnReceiver([call_id, state, data]: [
        CallId,
        "resolve" | "reject",
        any,
    ]) {
        const callback = _callbacks[call_id];
        if (callback) {
            delete _callbacks[call_id];
            callback[state](data);
        }
    },
};

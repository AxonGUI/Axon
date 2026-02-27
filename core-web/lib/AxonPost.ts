import { v4 as uuid_v4 } from "uuid";
import { AxonGUI } from "./AxonGUI.ts";
type PostId = string;
const _callbacks = {} as {
    [key in PostId]: {
        resolve: (value: any) => void;
        reject: (reason?: any) => void;
    };
};
export const AxonPost = {
    init() {
        const channel = AxonGUI.py_channels["AxonPostHandler"];
        try {
            channel.responseReceiverSignal.disconnect(AxonPost.responseReceiver);
        } catch { }
        channel.responseReceiverSignal.connect(AxonPost.responseReceiver);
    },
    post({
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
            const post_id = uuid_v4();
            if (timeout !== undefined) {
                let timeout_timer: number | undefined;
                _callbacks[post_id] = {
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
                        AxonPost.responseReceiver([
                            post_id,
                            "reject",
                            `Timeout Error, py not return in ${timeout}ms`,
                        ]),
                    timeout,
                );
            } else _callbacks[post_id] = { resolve, reject };
            AxonGUI.py_channels["AxonPostHandler"]["onPost"]({
                post_id,
                web_name: window.AxonEnv.web_name,
                controller_id,
                func,
                args,
                kwargs,
            });
        });
    },
    crossPost(data: {
        web_name: string;
        controller_id: string;
        func: string;
        args?: any[];
        timeout?: number;
    }) {
        const { timeout, ...payload } = data;
        return AxonPost.post({
            controller_id: "AxonCrossPostHandler",
            func: "onPost",
            args: [payload],
            timeout: timeout,
        });
    },
    responseReceiver([post_id, state, data]: [
        PostId,
        "resolve" | "reject",
        any,
    ]) {
        const callback = _callbacks[post_id];
        if (callback) {
            delete _callbacks[post_id];
            callback[state](data);
        }
    },
};

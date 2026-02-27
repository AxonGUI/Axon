import promiseRetry from "promise-retry";
import { QWebChannel } from "qwebchannel/qwebchannel.js";
import { AxonPostHandler } from "./AxonPostHandler.ts";
import { AxonPost } from "./AxonPost.ts";
export type AnyFunction = (...args: any[]) => any;
declare global {
    interface Window {
        AxonGUI: typeof AxonGUI;
        AxonPostHandler: typeof AxonPostHandler;
        AxonEnv: { web_name: string };
    }
}
declare global {
    interface Window {
        qt: any;
    }
}
export async function initAxonGUI() {
    window.AxonGUI = AxonGUI;
    window.AxonPostHandler = AxonPostHandler;
    await initChannels();
}
async function initChannels() {
    if (window.qt) {
        await promiseRetry(
            async () => {
                return new Promise<void>((resolve) => {
                    new QWebChannel(window.qt.webChannelTransport, function (
                        channel: any,
                    ) {
                        AxonGUI.py_channels = channel.objects;
                        AxonPostHandler.init();
                        AxonPost.init();
                        channel.objects["AxonEnv"].env().then((r: any) => {
                            window.AxonEnv = r;
                            resolve();
                        });
                    });
                });
            },
            { retries: 50, minTimeout: 10, maxTimeout: 10 },
        ).catch((err) => {
            console.error(
                `[AxonGUI] QWebChannel 初始化彻底失败。 - 重试次数: 50 - 错误信息: ${err?.message || "未知错误"}`,
            );
        });
    } else {
        console.error("qt init fail");
    }
}
export const AxonGUI = { py_channels: {} as any, ...AxonPost };
export type * from "./AxonEvent.ts";
export { AxonEvent } from "./AxonEvent.ts";
export type * from "./AxonEventQt.ts";
export { AxonController } from "./AxonPostHandler.ts";

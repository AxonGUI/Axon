import promiseRetry from "promise-retry";
import { QWebChannel } from "qwebchannel/qwebchannel.js";
import { AxonJSCallHandler } from "./AxonCall";
import { AxonPYCall } from "./AxonPYCallHandler";
import { WebName } from "./types";
export let AxonChannels = {} as {
  AxonEnv: {
    web_name: WebName;
  };
  AxonPYCall: AxonPYCall;
  AxonJSCallHandler: AxonJSCallHandler;
};
export async function initChannels() {
  if (window.qt) {
    await promiseRetry(
      async () => {
        return new Promise<void>((resolve) => {
          new QWebChannel(window.qt.webChannelTransport, function (
            channel: any,
          ) {
            AxonChannels = channel.objects;
            resolve();
          });
        });
      },
      { retries: 50, minTimeout: 10, maxTimeout: 10 },
    ).catch((err) => {
      console.error(
        `[AxonChannel] QWebChannel 初始化彻底失败。 - 重试次数: 50 - 错误信息: ${err?.message || "未知错误"}`,
      );
    });
  } else {
    console.error("qt init fail");
  }
}

import { AxonCall } from "./AxonCall.ts";
import { initChannels } from "./AxonChannel.ts";
import { AxonPYCallHandler } from "./AxonPYCallHandler.ts";
export type AnyFunction = (...args: any[]) => any;
declare global {
  interface Window {
    AxonCallHandler: typeof AxonPYCallHandler;
    AxonEnv: { web_name: string };
  }
}
declare global {
  interface Window {
    qt: any;
  }
}
export async function AxonInit() {
  await initChannels();
  await AxonPYCallHandler.init();
  await AxonCall.init();
}
export { AxonCall } from "./AxonCall.ts";
export type * from "./AxonEvent.ts";
export { AxonEvent } from "./AxonEvent.ts";
export type * from "./AxonEventQt.ts";
export { AxonController } from "./AxonPYCallHandler.ts";

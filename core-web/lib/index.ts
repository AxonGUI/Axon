import { initChannels } from "./AxonChannel.ts";
import { AxonCall } from "./AxonJSCall.ts";
import { AxonPYCallHandler } from "./AxonPYCallHandler.ts";
export async function AxonInit() {
  await initChannels();
  await AxonPYCallHandler.init();
  await AxonCall.init();
}
export { Axon } from "./Axon.ts";
export type * from "./AxonEvent.ts";
export { AxonEvent } from "./AxonEvent.ts";
export type * from "./AxonEventQt.ts";
export { AxonCall } from "./AxonJSCall.ts";
export { AxonController } from "./AxonPYCallHandler.ts";

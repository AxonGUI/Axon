import { AxonQtEventMap } from "./AxonEventQt";
import { AxonCall } from "./AxonJSCall";
import { AxonController } from "./AxonPYCallHandler";
export interface AxonEventMap extends AxonQtEventMap {}
type EventListeners = Partial<{
  [K in keyof AxonEventMap]: Set<AxonEventMap[K]>;
}>;
type OnceEventListenerMap = Partial<{
  [K in keyof AxonEventMap]: Map<AxonEventMap[K], AxonEventMap[K]>;
}>;
export type AddEventListenerOptions = { once: boolean };
export const AxonEvent = new (class {
  __listeners: EventListeners;
  __onceEventListenerMap: OnceEventListenerMap;
  constructor() {
    this.__listeners = {};
    this.__onceEventListenerMap = {};
  }
  on = this.addListener;
  off = this.removeListener;
  addListener<K extends keyof AxonEventMap>(
    type: K,
    listener: AxonEventMap[K],
    options?: AddEventListenerOptions,
  ) {
    AxonEvent.__listeners[type] ||= new Set<any>();
    AxonEvent.__onceEventListenerMap[type] ||= new Map();
    if (AxonEvent.__listeners[type].has(listener)) return;
    if (AxonEvent.__onceEventListenerMap[type].has(listener)) return;
    if (options?.once) {
      const raw_listener = listener as any;
      listener = (...args: any[]) => {
        AxonEvent.removeListener(type, raw_listener);
        raw_listener(...args);
      };
      AxonEvent.__onceEventListenerMap[type].set(raw_listener, listener);
    }
    AxonEvent.__listeners[type].add(listener);
  }
  removeListener<K extends keyof AxonEventMap>(
    type: K,
    listener: AxonEventMap[K],
  ) {
    if (!AxonEvent.__listeners[type] || !AxonEvent.__onceEventListenerMap[type])
      return;
    const wrapper = AxonEvent.__onceEventListenerMap[type].get(listener);
    if (wrapper) {
      AxonEvent.__onceEventListenerMap[type].delete(listener);
      AxonEvent.__listeners[type].delete(wrapper);
      return;
    }
    AxonEvent.__listeners[type].delete(listener);
  }
  removeAllListeners<K extends keyof AxonEventMap>(type: K) {
    AxonEvent.__listeners[type]?.clear();
    AxonEvent.__onceEventListenerMap[type]?.clear();
  }
  dispatchEvent<K extends keyof AxonEventMap>(
    type: K,
    ...args: Parameters<AxonEventMap[K]>
  ) {
    AxonEvent.__listeners[type]?.forEach((f) => {
      try {
        (f as any)(...args);
      } catch (error) {
        console.error(`事件监听器执行异常 - 事件类型: ${type}`, error);
      }
    });
  }
  dispatchPYEvent({
    type,
    args = [],
    kwargs = {},
  }: {
    type: string;
    args?: any[];
    kwargs?: Record<string, any>;
  }) {
    return AxonCall.call({
      controller_id: "AxonEvent",
      func: "dispatch_event",
      args: [type, ...args],
      kwargs: kwargs,
    });
  }
})();
AxonController.register("AxonEvent", AxonEvent);

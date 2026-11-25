import { AxonQtEventMap } from "./AxonEventQt";
import { AxonCall } from "./AxonJSCall";
import { AxonController } from "./AxonPYCallHandler";
export interface AxonEventMap extends AxonQtEventMap {}
/** 允许自定义事件名：内置事件走类型推导，自定义事件退回 `(...args: any[]) => any`。 */
export type AxonEventName = keyof AxonEventMap | (string & {});
export type AxonEventListener<K extends AxonEventName> = K extends keyof AxonEventMap
  ? AxonEventMap[K]
  : (...args: any[]) => any;
type EventListeners = Record<string, Set<any>>;
type OnceEventListenerMap = Record<string, Map<any, any>>;
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
  addListener<K extends AxonEventName>(
    type: K,
    listener: AxonEventListener<K>,
    options?: AddEventListenerOptions,
  ) {
    let fn: any = listener;
    AxonEvent.__listeners[type] ||= new Set<any>();
    AxonEvent.__onceEventListenerMap[type] ||= new Map();
    if (AxonEvent.__listeners[type].has(listener)) return;
    if (AxonEvent.__onceEventListenerMap[type].has(listener)) return;
    if (options?.once) {
      const raw_listener = listener as any;
      fn = (...args: any[]) => {
        AxonEvent.removeListener(type, raw_listener);
        raw_listener(...args);
      };
      AxonEvent.__onceEventListenerMap[type].set(raw_listener, fn);
    }
    AxonEvent.__listeners[type].add(fn);
  }
  removeListener<K extends AxonEventName>(
    type: K,
    listener: AxonEventListener<K>,
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
  removeAllListeners<K extends AxonEventName>(type: K) {
    AxonEvent.__listeners[type]?.clear();
    AxonEvent.__onceEventListenerMap[type]?.clear();
  }
  dispatchEvent<K extends AxonEventName>(
    type: K,
    ...args: K extends keyof AxonEventMap ? Parameters<AxonEventMap[K]> : any[]
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

import { AxonQtEventMap } from './AxonEventQt';

export interface AxonEventMap extends AxonQtEventMap {
}
/** 允许自定义事件名：内置事件走类型推导，自定义事件退回 `(...args: any[]) => any`。 */
export type AxonEventName = keyof AxonEventMap | (string & {});
export type AxonEventListener<K extends AxonEventName> = K extends keyof AxonEventMap ? AxonEventMap[K] : (...args: any[]) => any;
type EventListeners = Record<string, Set<any>>;
type OnceEventListenerMap = Record<string, Map<any, any>>;
export type AddEventListenerOptions = {
    once: boolean;
};
export declare const AxonEvent: {
    __listeners: EventListeners;
    __onceEventListenerMap: OnceEventListenerMap;
    on: <K extends AxonEventName>(type: K, listener: AxonEventListener<K>, options?: AddEventListenerOptions) => void;
    off: <K extends AxonEventName>(type: K, listener: AxonEventListener<K>) => void;
    addListener<K extends AxonEventName>(type: K, listener: AxonEventListener<K>, options?: AddEventListenerOptions): void;
    removeListener<K extends AxonEventName>(type: K, listener: AxonEventListener<K>): void;
    removeAllListeners<K extends AxonEventName>(type: K): void;
    dispatchEvent<K extends AxonEventName>(type: K, ...args: K extends keyof AxonEventMap ? Parameters<AxonEventMap[K]> : any[]): void;
    dispatchPYEvent({ type, args, kwargs, }: {
        type: string;
        args?: any[];
        kwargs?: Record<string, any>;
    }): Promise<any>;
};
export {};

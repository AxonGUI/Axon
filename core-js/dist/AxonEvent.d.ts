import { AxonQtEventMap } from './AxonEventQt';

export interface AxonEventMap extends AxonQtEventMap {
}
type EventListeners = Partial<{
    [K in keyof AxonEventMap]: Set<AxonEventMap[K]>;
}>;
type OnceEventListenerMap = Partial<{
    [K in keyof AxonEventMap]: Map<AxonEventMap[K], AxonEventMap[K]>;
}>;
export type AddEventListenerOptions = {
    once: boolean;
};
export declare const AxonEvent: {
    __listeners: EventListeners;
    __onceEventListenerMap: OnceEventListenerMap;
    on: <K extends keyof AxonEventMap>(type: K, listener: AxonEventMap[K], options?: AddEventListenerOptions) => void;
    off: <K extends keyof AxonEventMap>(type: K, listener: AxonEventMap[K]) => void;
    addListener<K extends keyof AxonEventMap>(type: K, listener: AxonEventMap[K], options?: AddEventListenerOptions): void;
    removeListener<K extends keyof AxonEventMap>(type: K, listener: AxonEventMap[K]): void;
    removeAllListeners<K extends keyof AxonEventMap>(type: K): void;
    dispatchEvent<K extends keyof AxonEventMap>(type: K, ...args: Parameters<AxonEventMap[K]>): void;
    dispatchPYEvent({ type, args, kwargs, }: {
        type: string;
        args?: any[];
        kwargs?: Record<string, any>;
    }): Promise<any>;
};
export {};

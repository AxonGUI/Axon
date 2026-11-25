declare global {
    interface Window {
        qt: any;
    }
}
export type CallId = string;
export type WebName = string;
export interface SignalInstance<T extends any[] = []> {
    connect(callback: (...args: T) => void): void;
    disconnect(callback: (...args: T) => void): void;
    emit(...args: T): void;
}

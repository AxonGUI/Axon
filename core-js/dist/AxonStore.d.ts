/**
 * store 里的一个键值。
 *
 * 两端同名: `get()` 读、`set(value)` 写、`setFromPeer(value)` 接收对端写入
 * （对端写进来时不回推, 避免两端来回弹）。
 */
export declare class AxonStoreProperty {
    name: string;
    value: any;
    store: AxonStore;
    constructor(name: string, value: any, store: AxonStore);
    get(): any;
    set(value: any): void;
    /** 由 Python 侧写入（Python 调这个）, 只更新本地值, 不再回推。 */
    setFromPeer(value: any): void;
}
export declare class AxonStore {
    static AxonStoreMap: Map<string, AxonStore>;
    static shared: AxonStore;
    id: string;
    store: Map<string, AxonStoreProperty>;
    controller_id: string;
    static init(): void;
    constructor(id: string, auto_create?: boolean);
    prop(name: string, value?: any): AxonStoreProperty;
    /** 读一个键: `store.get("k")` 等价于 `store.prop("k")`。 */
    get(prop: string): AxonStoreProperty;
    /** 写一个键: `store.set("k", 1)` 等价于 `store.prop("k").set(1)`。 */
    set(prop: string, value: any): void;
    /** 由 Python 侧写入, 只更新本地值。 */
    setFromPeer(prop: string, value: any): void;
    release(): void;
    _release(): void;
}

/**
 * store 里的一个键值。
 *
 * 两端同名: `get()` 读、`set(value)` 写、`setFromPeer(value)` 接收对端写入
 * （对端写进来时不回推, 避免两端来回弹）。
 */
export declare class AxonStoreProperty<T = any> {
    name: string;
    value: T;
    store: AxonStore;
    constructor(name: string, value: T, store: AxonStore);
    get(): T;
    /**
     * 让 `await store.get("k")` 直接拿到值（和 `Axon.Ctl.prop` 的手感一致）。
     * 不改变 `store.get("k").get()` 的同步用法。
     */
    then<R1 = T, R2 = never>(onFulfilled?: ((value: T) => R1 | PromiseLike<R1>) | null, onRejected?: ((reason: any) => R2 | PromiseLike<R2>) | null): Promise<R1 | R2>;
    set(value: T): void;
    /** 由 Python 侧写入（Python 调这个）, 只更新本地值, 不再回推。 */
    setFromPeer(value: T): void;
}
export declare class AxonStore {
    static AxonStoreMap: Map<string, AxonStore>;
    static shared: AxonStore;
    id: string;
    store: Map<string, AxonStoreProperty>;
    controller_id: string;
    static init(): void;
    constructor(id: string, auto_create?: boolean);
    prop<T = any>(name: string, value?: T): AxonStoreProperty<T>;
    /** 读一个键: `store.get("k")` 等价于 `store.prop("k")`。 */
    get<T = any>(prop: string): AxonStoreProperty<T>;
    /** 写一个键: `store.set("k", 1)` 等价于 `store.prop("k").set(1)`。 */
    set(prop: string, value: any): void;
    /** 由 Python 侧写入, 只更新本地值。 */
    setFromPeer(prop: string, value: any): void;
    release(): void;
    _release(): void;
}

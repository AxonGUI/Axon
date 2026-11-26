import { AxonChannels } from "./AxonChannel";
import { AxonCall } from "./AxonJSCall";
import { AxonController } from "./AxonPYCallHandler";

/**
 * store 里的一个键值。
 *
 * 两端同名: `get()` 读、`set(value)` 写、`setFromPeer(value)` 接收对端写入
 * （对端写进来时不回推, 避免两端来回弹）。
 */
export class AxonStoreProperty<T = any> {
  name: string;
  value: T;
  store: AxonStore;

  constructor(name: string, value: T, store: AxonStore) {
    this.name = name;
    this.value = value;
    this.store = store;
  }

  get(): T {
    return this.value;
  }

  /**
   * 让 `await store.get("k")` 直接拿到值（和 `Axon.Ctl.prop` 的手感一致）。
   * 不改变 `store.get("k").get()` 的同步用法。
   */
  then<R1 = T, R2 = never>(
    onFulfilled?: ((value: T) => R1 | PromiseLike<R1>) | null,
    onRejected?: ((reason: any) => R2 | PromiseLike<R2>) | null,
  ): Promise<R1 | R2> {
    return Promise.resolve(this.value).then(onFulfilled, onRejected);
  }

  set(value: T) {
    if (this.value === value) return;
    this.value = value;
    // 走 Python 的 set: 由它统一推给所有窗口（含本窗口, 本窗口值已相等会 no-op），
    // 否则一个窗口写进去的值别的窗口看不到。
    AxonCall.call({
      controller_id: this.store.controller_id,
      func: "set",
      args: [this.name, value],
    });
  }

  /** 由 Python 侧写入（Python 调这个）, 只更新本地值, 不再回推。 */
  setFromPeer(value: T) {
    if (this.value === value) return;
    this.value = value;
  }
}

export class AxonStore {
  static AxonStoreMap = new Map<string, AxonStore>();
  static shared: AxonStore;
  id!: string;
  store!: Map<string, AxonStoreProperty>;
  controller_id!: string;

  static init() {
    AxonStore.shared = new AxonStore("__shared__");
    AxonController.register(AxonStore.shared.id, AxonStore.shared);
    AxonController.register(
      "JSAxonStoreSyncManager",
      new AxonStoreSyncManager(),
    );
  }

  constructor(id: string, auto_create = true) {
    if (AxonStore.AxonStoreMap.has(id)) return AxonStore.AxonStoreMap.get(id)!;
    this.id = id;
    this.controller_id = `__AxonStore_${this.id}__`;
    this.store = new Map();
    AxonStore.AxonStoreMap.set(id, this);
    AxonController.register(this.controller_id, this);
    if (auto_create)
      AxonCall.call({
        controller_id: "PYAxonStoreSyncManager",
        func: "createStore",
        args: [this.id, AxonChannels.AxonEnv.web_name],
      });
  }

  prop<T = any>(name: string, value?: T): AxonStoreProperty<T> {
    if (this.store.has(name)) return this.store.get(name) as AxonStoreProperty<T>;
    const prop = new AxonStoreProperty<T>(name, value as T, this);
    this.store.set(name, prop);
    return prop;
  }

  /** 读一个键: `store.get("k")` 等价于 `store.prop("k")`。 */
  get<T = any>(prop: string): AxonStoreProperty<T> {
    return this.prop(prop);
  }

  /** 写一个键: `store.set("k", 1)` 等价于 `store.prop("k").set(1)`。 */
  set(prop: string, value: any): void {
    this.prop(prop).set(value);
  }

  /** 由 Python 侧写入, 只更新本地值。 */
  setFromPeer(prop: string, value: any): void {
    this.prop(prop).setFromPeer(value);
  }

  release() {
    this._release();
    AxonCall.call({
      controller_id: "PYAxonStoreSyncManager",
      func: "deleteStore",
      args: [this.id, AxonChannels.AxonEnv.web_name],
    });
  }

  _release() {
    AxonStore.AxonStoreMap.delete(this.id);
    AxonController.unregister(this.controller_id);
  }
}

class AxonStoreSyncManager {
  createStore(id: string) {
    return new AxonStore(id);
  }
  deleteStore(id: string) {
    const axonStore = AxonStore.AxonStoreMap.get(id);
    if (!axonStore) return;
    axonStore._release();
  }
}

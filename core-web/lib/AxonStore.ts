import { AxonChannels } from "./AxonChannel";
import { AxonCall } from "./AxonJSCall";
import { AxonController } from "./AxonPYCallHandler";

export class AxonStoreProperty {
  name: string;
  value: any;
  store: AxonStore;

  constructor(name: string, value: any, store: AxonStore) {
    this.name = name;
    this.value = value;
    this.store = store;
  }

  get(): any {
    return this.value;
  }

  set(value: any) {
    if (this.value === value) return;
    this.value = value;
    AxonCall.call({
      controller_id: this.store.controller_id,
      func: "JSSet",
      args: [this.name, value],
    });
  }
  PYSet(value: any) {
    if (this.value === value) return;
    this.value = value;
  }
}

export class AxonStore {
  static AxonStoreMap = new Map<string, AxonStore>();
  static shared = new AxonStore("__shared__");
  id!: string;
  store!: Map<string, AxonStoreProperty>;
  controller_id!: string;

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

  prop(name: string, value: any = undefined): AxonStoreProperty {
    if (this.store.has(name)) return this.store.get(name)!;
    const prop = new AxonStoreProperty(name, value, this);
    this.store.set(name, prop);
    return prop;
  }
  get(prop: string) {
    return this.prop(prop);
  }
  PYSet(prop: string, value: any) {
    this.prop(prop).PYSet(value);
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
AxonController.register(AxonStore.shared.id, AxonStore.shared);

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
AxonController.register("JSAxonStoreSyncManager", new AxonStoreSyncManager());

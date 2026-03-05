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
      func: "onSync",
      args: [this.name, value],
    });
  }
  onSync(value: any) {
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
    AxonController.register(this.controller_id, this);
    if (auto_create)
      AxonCall.call({
        controller_id: "PYAxonStoreSyncManager",
        func: "createStore",
        args: [this.controller_id, AxonChannels.AxonEnv.web_name],
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
  onSync(prop: string, value: any) {
    this.prop(prop).onSync(value);
  }
}
AxonController.register(AxonStore.shared.id, AxonStore.shared);

class AxonStoreSyncManager {
  createStore(id: string) {
    return new AxonStore(id);
  }
}
AxonController.register("JSAxonStoreSyncManager", new AxonStoreSyncManager());

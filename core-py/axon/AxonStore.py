from __future__ import annotations

import threading
from typing import Any, cast

from .AxonJSCallHandler import AxonController
from .AxonPYCall import AxonCall


class AxonStoreProperty:
    def __init__(self, name: str, value: Any, store: AxonStoreBase):
        self.name = name
        self.value = value
        self.store = store
        self.lock = threading.Lock()

    def __get__(self, instance, owner):
        with self.lock:
            return self.value

    def __set__(self, instance, value):
        with self.lock:
            if self.value == value:
                return
            self.value = value
        for web_name in self.store.web_names:
            AxonCall.call(
                web_name,
                self.store.controller_id,
                "PYSet",
                [self.name, value],
            )

    def JSSet(self, value):
        with self.lock:
            if self.value == value:
                return
            self.value = value


class AxonStoreBase:
    AxonStoreDict: dict[str, AxonStoreBase] = {}

    def __new__(cls, id, *web_names: str, auto_create=True):
        if id in AxonStoreBase.AxonStoreDict:
            store = AxonStoreBase.AxonStoreDict[id]
            if isinstance(store, AxonStore):
                for web_name in web_names:
                    if web_name not in store.web_names:
                        store.add_web(web_name)
            return store
        instance = super().__new__(cls)
        AxonStoreBase.AxonStoreDict[id] = instance
        return instance

    def __init__(self, id: str, *web_names: str, auto_create=True):
        if hasattr(self, "_initialized"):
            return
        self.id = id
        self.controller_id = f"__AxonStore_{self.id}__"
        self._web_names = list(web_names)
        self.store = dict[str, AxonStoreProperty]()
        self._initialized = True
        for web_name in web_names:
            AxonController.register(self, web_name, self.controller_id)
            if auto_create:
                AxonCall.call(
                    web_name,
                    "JSAxonStoreSyncManager",
                    "createStore",
                    [self.controller_id],
                )

    @property
    def web_names(self):
        return self._web_names

    def prop(self, name: str, value: Any = None) -> AxonStoreProperty:
        if name in self.store:
            return self.store[name]
        prop = AxonStoreProperty(name, value, self)
        self.store[name] = prop
        return prop

    def __getattr__(self, prop: str) -> AxonStoreProperty:
        return self.prop(prop)

    def JSSet(self, name: str, value):
        self.prop(name).JSSet(value)

    def release(self):
        self._release()
        for web_name in self.web_names:
            AxonCall.call(
                web_name,
                "JSAxonStoreSyncManager",
                "deleteStore",
                [self.controller_id],
            )

    def _release(self):
        del self.AxonStoreDict[self.id]
        for web_name in self.web_names:
            AxonController.unregister(self.controller_id, web_name)


class AxonStore(AxonStoreBase):
    def add_web(self, web_name: str):
        self.web_names.append(web_name)
        AxonController.register(self, web_name, self.controller_id)

    def remove_web(self, web_name: str):
        self.web_names.remove(web_name)
        AxonController.unregister(self.controller_id, web_name)

    shared: SharedAxonStore


class SharedAxonStore(AxonStore):
    def __new__(cls) -> SharedAxonStore:
        return super().__new__(cls, "__shared__")  # type: ignore

    def __init__(self):
        super().__init__("__shared__")

    @property
    def web_names(self):  # type: ignore
        from .AxonGUI import AxonGUI

        return AxonGUI.get_web_names()


AxonStore.shared = SharedAxonStore()

AxonController.register(AxonStore.shared, id=AxonStore.shared.controller_id)


@AxonController(shared=True, id="PYAxonStoreSyncManager")
class AxonStoreSyncManager:
    def createStore(self, id: str, *web_names: str):
        AxonStore(id, *web_names, auto_create=False)

    def deleteStore(self, id: str, web_name: str):
        axon_store = AxonStoreBase.AxonStoreDict.get(id)
        if axon_store is None:
            return
        axon_store = cast(AxonStore, axon_store)
        axon_store.remove_web(web_name)

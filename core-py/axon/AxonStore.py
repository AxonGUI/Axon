from __future__ import annotations

from typing import Any

from .AxonJSCallHandler import AxonController
from .AxonPYCall import AxonCall


class AxonStoreProperty:
    def __init__(self, name: str, value: Any, store: AxonStoreBase):
        self.name = name
        self.value = value
        self.store = store

    def __get__(self, instance, owner):
        return self.value

    def __set__(self, instance, value):
        self.value = value
        for web_name in self.store.web_names:
            AxonCall.setVar(web_name, self.store.controller_id, self.name, value)


class AxonStoreBase:
    def __init__(self, id: str, *web_names: str):
        self.id = id
        self.controller_id = f"__AxonStore_{self.id}__"
        self.web_names = list(web_names)
        self.store = dict[str, AxonStoreProperty]()

    def prop(self, name: str, value: Any = None) -> AxonStoreProperty:
        if name in self.store:
            return self.store[name]
        prop = AxonStoreProperty(name, value, self)
        self.store[name] = prop
        return prop

    def __getattr__(self, prop: str) -> AxonStoreProperty:
        return self.prop(prop)


class AxonStore(AxonStoreBase):
    def add_web(self, web_name: str):
        self.web_names.append(web_name)
        AxonController.register(self, web_name, self.controller_id)

    def remove_web(self, web_name: str):
        self.web_names.remove(web_name)
        AxonController.unregister(self.controller_id, web_name)

    shared: SharedAxonStore


@AxonController(shared=True)
class SharedAxonStore(AxonStore):
    def __init__(self):
        super().__init__("__shared__")


AxonStore.shared = SharedAxonStore()

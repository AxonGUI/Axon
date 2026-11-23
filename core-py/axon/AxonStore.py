from __future__ import annotations

import threading
from typing import Any, cast

from .AxonJSCallHandler import AxonController
from .AxonPYCall import AxonCall


class AxonStoreProperty:
    """store 里的一个键值。

    读写 API 与 JS 侧对齐: ``get()`` / ``set(value)`` / ``.value``。
    """

    def __init__(self, name: str, value: Any, store: AxonStoreBase):
        self.name = name
        self._value = value
        self.store = store
        self.lock = threading.Lock()

    @property
    def value(self) -> Any:
        with self.lock:
            return self._value

    def get(self) -> Any:
        return self.value

    def set(self, value: Any):
        """写入并通知所有持有该 store 的网页。"""
        with self.lock:
            if self._value == value:
                return
            self._value = value
        for web_name in list(self.store.web_names):
            AxonCall.call(
                web_name,
                self.store.controller_id,
                "setFromPeer",
                [self.name, value],
            )

    def setFromPeer(self, value):
        """JS 侧写入后回填, 不再回推。"""
        with self.lock:
            self._value = value

    # 兼容「把 AxonStoreProperty 当类属性用」的旧写法
    def __get__(self, instance, owner):
        return self.value

    def __set__(self, instance, value):
        self.set(value)

    def __repr__(self) -> str:
        return f"<AxonStoreProperty {self.store.id}.{self.name}={self._value!r}>"


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
        instance._initialized = False
        return instance

    #: 这些名字是 store 自身的字段, 不能被当成 store 里的键
    _RESERVED = ("id", "controller_id", "store")

    def __setattr__(self, name: str, value: Any):
        if name.startswith("_") or name in AxonStoreBase._RESERVED:
            object.__setattr__(self, name, value)
            return
        # store.foo = 1 等价于 store.prop("foo").set(1)
        self.prop(name).set(value)

    def __init__(self, id: str, *web_names: str, auto_create=True):
        if self._initialized:
            return
        self.id = id
        self.controller_id = f"__AxonStore_{self.id}__"
        self._web_names = list(web_names)
        self.store = dict[str, AxonStoreProperty]()
        self._initialized = True
        for web_name in web_names:
            AxonController.register(self, web_name, self.controller_id)
            if auto_create:
                # 传 store id: JS 侧 createStore(id) 用它当 map key 并自己拼 controller_id,
                # 早先传 controller_id 会让 JS 侧的 id 变成 __AxonStore___AxonStore_x____。
                AxonCall.call(
                    web_name,
                    "JSAxonStoreSyncManager",
                    "createStore",
                    [self.id],
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
        # 下划线名和 store 自身字段不能当作 store 键:
        # 否则 __init__ 早期访问 self.store 会经 prop() 再访问 self.store, 无限递归。
        if prop.startswith("_") or prop in AxonStoreBase._RESERVED:
            raise AttributeError(prop)
        return self.prop(prop)

    def setFromPeer(self, name: str, value):
        self.prop(name).setFromPeer(value)

    #: get/set 便捷方法: `store.get("k")` / `store.set("k", 1)`
    def get(self, name: str) -> Any:
        return self.prop(name).get()

    def set(self, name: str, value: Any) -> None:
        self.prop(name).set(value)

    def release(self):
        self._release()
        for web_name in self.web_names:
            AxonCall.call(
                web_name,
                "JSAxonStoreSyncManager",
                "deleteStore",
                [self.id],
            )

    def _release(self):
        del self.AxonStoreDict[self.id]
        for web_name in self.web_names:
            AxonController.unregister(self.controller_id, web_name)


class AxonStore(AxonStoreBase):
    def add_web(self, web_name: str):
        # 用 _web_names: SharedAxonStore 把 web_names 覆写成了只读 property
        # (直接取 AxonGUI.get_web_names()), 对它 append 会 AttributeError。
        if web_name not in self._web_names:
            self._web_names.append(web_name)
        AxonController.register(self, web_name, self.controller_id)

    def remove_web(self, web_name: str):
        if web_name in self._web_names:
            self._web_names.remove(web_name)
        AxonController.unregister(self.controller_id, web_name)

    shared: SharedAxonStore


class SharedAxonStore(AxonStore):
    def __new__(cls, *args, **kwargs) -> SharedAxonStore:
        return super().__new__(cls, "__shared__")  # type: ignore

    def __init__(self, *args, **kwargs):
        super().__init__("__shared__")

    @property
    def web_names(self):  # type: ignore
        from .AxonGUI import AxonGUI

        # 返回 list 而不是 dict_keys: 迭代过程中可能有窗口创建/销毁
        return list(AxonGUI.get_web_names())


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

from __future__ import annotations

import asyncio
from concurrent.futures import Future
from typing import Any

from .AxonPYCall import broadcast as _py_broadcast
from .AxonPYCall import call as _py_call
from .AxonPYCall import getVar as _py_getVar
from .AxonPYCall import setVar as _py_setVar


class _JSProperty:
    """JS 侧对象的一个成员: 既能当方法调, 也能当属性读。

    - ``Axon("w").Ctl.func(1, 2)``  → 调用 JS 方法, 返回 ``Future``
    - ``await Axon("w").Ctl.prop``  → 读取 JS 属性
    - ``Axon("w").Ctl.prop.get()``  → 同步读取 (会阻塞)
    """

    def __init__(self, web_name: str, controller_id: str, prop: str) -> None:
        self.web_name = web_name
        self.controller_id = controller_id
        self.prop = prop
        self._get_future: Future | None = None

    def _ensure_get(self) -> Future:
        if self._get_future is None:
            self._get_future = _py_getVar(self.web_name, self.controller_id, self.prop)
        return self._get_future

    def call(self, *args: Any, kwargs: dict | None = None) -> Future:
        """调用 JS 方法并返回 ``Future``; 需要限时请 ``.result(timeout=...)``。"""
        return _py_call(
            self.web_name,
            self.controller_id,
            self.prop,
            args,
            kwargs=kwargs,
        )

    def __call__(self, *args: Any, **kwargs: Any) -> Future:
        return _py_call(
            self.web_name,
            self.controller_id,
            self.prop,
            args,
            kwargs=kwargs or None,
        )

    def get(self, timeout: float | None = None) -> Any:
        """同步读取属性值 (阻塞当前线程)。"""
        return self._ensure_get().result(timeout)

    def __await__(self):
        # 关键: 必须返回迭代器。旧实现 ``return future.result()`` 返回的是一个值,
        # 于是 ``await`` 直接抛 ``TypeError: __await__() returned non-iterator``。
        return asyncio.wrap_future(self._ensure_get()).__await__()

    def __getattr__(self, name: str):
        # 把 result()/add_done_callback() 等 Future 方法透传出去
        if name.startswith("__"):
            raise AttributeError(name)
        return getattr(self._ensure_get(), name)

    def __repr__(self) -> str:
        return f"<JSProperty {self.controller_id}.{self.prop} @ {self.web_name}>"




class JSController:
    """``Axon("web").Controller`` 对应的代理对象。"""

    def __init__(self, web_name: str, controller_id: str) -> None:
        # 必须用 object.__setattr__: 本类重写了 __setattr__ (写属性 = 写 JS),
        # 直接 ``self.x = ...`` 会触发 __setattr__ 里对未初始化字段的访问,
        # 经 __getattr__ 又生成新的 JSController, 无限递归。
        object.__setattr__(self, "web_name", web_name)
        object.__setattr__(self, "controller_id", controller_id)
        object.__setattr__(self, "_last_future", None)

    def __getattr__(self, prop: str):
        if prop.startswith("__"):
            raise AttributeError(prop)
        return _JSProperty(self.web_name, self.controller_id, prop)

    def __setattr__(self, prop: str, value: Any):
        # 写 JS 属性是「发出即忘」: 不能在这里阻塞等待 JS 回复,
        # 因为回复要回到 Qt 主线程, 主线程阻塞 = 死锁。
        future = _py_setVar(self.web_name, self.controller_id, prop, value)
        object.__setattr__(self, "_last_future", future)

    def __repr__(self) -> str:
        return f"<JSController {self.controller_id} @ {self.web_name}>"


class Axon:
    """Python 侧访问 JS 的入口: ``Axon("web_name").Controller.func(...)``。"""

    broadcast: "AxonBroadcast"

    def __init__(self, web_name: str) -> None:
        object.__setattr__(self, "_web_name", web_name)

    def __getattr__(self, controller_id: str):
        if controller_id.startswith("__"):
            raise AttributeError(controller_id)
        return JSController(self._web_name, controller_id)

    def __repr__(self) -> str:
        return f"<Axon web={self._web_name!r}>"


class BroadcastJSProperty(_JSProperty):
    def __call__(self, *args: Any, **kwargs: Any):  # type: ignore[override]
        return _py_broadcast(
            self.controller_id, self.prop, args, kwargs=kwargs or None
        )

    def call(self, *args: Any, kwargs: dict | None = None):  # type: ignore[override]
        return _py_broadcast(self.controller_id, self.prop, args, kwargs=kwargs)


class BroadcastJSController(JSController):
    def __getattr__(self, prop: str):  # type: ignore[override]
        if prop.startswith("__"):
            raise AttributeError(prop)
        return BroadcastJSProperty(
            self.web_name,
            self.controller_id,
            prop,
        )


class AxonBroadcast(Axon):
    def __init__(self):
        super().__init__("__axon__broadcast__")

    def __getattr__(self, controller_id: str):
        if controller_id.startswith("__"):
            raise AttributeError(controller_id)
        return BroadcastJSController(
            self._web_name,
            controller_id,
        )


Axon.broadcast = AxonBroadcast()

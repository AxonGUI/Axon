"""跨端事件：Python 侧监听 / 派发，与 JS 侧 ``AxonEvent`` 同名同语义。

两个方向：

* **JS 发 → Python 收**：页面 ``AxonEvent.dispatchPYEvent({type, args})``，
  这里 ``AxonEvent.add_listener(type, fn)`` 接。
* **Python 发 → JS 收**：``dispatch_js_event(web, type, args)``，
  页面 ``AxonEvent.addListener(type, fn)`` 接。
"""

from __future__ import annotations

import threading
import traceback
from typing import Any, Callable, Literal, Sequence, TypedDict

from .AxonJSCallHandler import AxonController
from .AxonPYCall import AxonCall, AxonFuture

EventType = Literal["test"] | str
EventListener = Callable[..., Any]
RawEventListener = Callable[..., Any]


class AddEventListenerOptions(TypedDict, total=False):
    """``once=True`` 时监听器执行一次就自动摘掉。"""

    once: bool


class _AxonEvent:
    """一个很小的 EventTarget 实现（线程安全，监听器异常不影响别人）。"""

    def __init__(self) -> None:
        self.__listeners: dict[EventType, set[EventListener]] = {}
        self.__once_event_listener_map: dict[
            EventType, dict[RawEventListener, EventListener]
        ] = {}
        self.__lock = threading.RLock()

    def on(
        self,
        type: EventType,
        listener: EventListener,
        options: AddEventListenerOptions | None = None,
    ) -> None:
        """``add_listener`` 的别名（跟 JS 侧 ``on`` 对齐）。"""
        self.add_listener(type, listener, options)

    def off(self, type: EventType, listener: EventListener) -> None:
        """``remove_listener`` 的别名。"""
        self.remove_listener(type, listener)

    def add_listener(
        self,
        type: EventType,
        listener: EventListener,
        options: AddEventListenerOptions | None = None,
    ) -> None:
        """注册一个监听器；同一个函数重复注册只算一次。"""
        with self.__lock:
            registered = self.__listeners.setdefault(type, set())
            if listener in registered:
                return
            once_map = self.__once_event_listener_map.setdefault(type, {})
            if listener in once_map:
                return
            if options and options.get("once"):
                raw_listener = listener

                def wrapper(*args: Any) -> Any:
                    self.remove_listener(type, raw_listener)
                    return raw_listener(*args)

                once_map[raw_listener] = wrapper
                listener = wrapper
            registered.add(listener)

    def remove_listener(self, type: EventType, listener: EventListener) -> None:
        """摘掉一个监听器（``once`` 注册的传原始函数即可）。"""
        with self.__lock:
            once_map = self.__once_event_listener_map.setdefault(type, {})
            wrapper = once_map.pop(listener, None)
            registered = self.__listeners.setdefault(type, set())
            if wrapper is not None:
                registered.discard(wrapper)
                return
            registered.discard(listener)

    def remove_all_listeners(self, type: EventType) -> None:
        """清空某个事件的全部监听器。"""
        with self.__lock:
            self.__listeners.setdefault(type, set()).clear()
            self.__once_event_listener_map.setdefault(type, {}).clear()

    def dispatch_event(self, type: EventType, *args: Any) -> None:
        """在本进程里同步派发（监听器抛异常只打印，不打断其它监听器）。"""
        with self.__lock:
            listeners = set(self.__listeners.get(type, ()))
        for listener in listeners:
            try:
                listener(*args)
            except Exception as e:  # noqa: BLE001 - 一个监听器炸了不该影响别的
                print(f"事件监听器执行异常 - 事件类型: {type}")
                print(f"异常信息: {e}")
                print("堆栈跟踪:")
                traceback.print_exc()

    @staticmethod
    def dispatch_js_event(
        web_name: str, type: str, args: Sequence[Any] = ()
    ) -> AxonFuture[Any]:
        """把事件发给**一个**窗口里的 JS（``AxonEvent.addListener`` 接）。"""
        return AxonCall.call(web_name, "AxonEvent", "dispatchEvent", [type, *args])

    @staticmethod
    def dispatch_js_event_batch(
        type: str,
        args: Sequence[Any] = (),
        web_names: Literal["*"] | list[str] = "*",
    ) -> list[AxonFuture[Any]]:
        """把同一个事件发给多个窗口（默认全部）。"""
        from .AxonGUI import AxonGUI

        targets = list(AxonGUI.get_web_names()) if web_names == "*" else web_names
        return [_AxonEvent.dispatch_js_event(wn, type, args) for wn in targets]


AxonEvent = _AxonEvent()

# 注册到 "*"：之后新建的每个窗口都会自动挂上同名 JS 对象
AxonController.register(AxonEvent, id="AxonEvent")

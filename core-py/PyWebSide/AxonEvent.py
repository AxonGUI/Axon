import threading
import traceback
from collections import defaultdict
from typing import Any, Callable, Literal, Optional, TypedDict
from .AxonPostHandler import AxonController

EventType = Literal["test"] | str
EventListener = Callable[..., Any]
RawEventListener = Callable[..., Any]
EventListeners = defaultdict[EventType, set[EventListener]]
OnceEventListenerMap = defaultdict[EventType, dict[RawEventListener, EventListener]]


class AddEventListenerOptions(TypedDict):
    once: bool


class _AxonEvent:
    def __init__(self):
        self.__listeners: EventListeners = defaultdict(set)
        self.__once_event_listener_map: OnceEventListenerMap = defaultdict(dict)
        self.__lock = threading.RLock()
        self.on = self.add_listener
        self.off = self.remove_listener

    def add_listener(
        self,
        type: EventType,
        listener: EventListener,
        options: Optional[AddEventListenerOptions] = None,
    ):
        with self.__lock:
            if listener in self.__listeners[type]:
                return
            if listener in self.__once_event_listener_map[type]:
                return
            if options and options.get("once"):
                raw_listener = listener

                def wrapper(*args):
                    self.remove_listener(type, raw_listener)
                    return raw_listener(*args)

                self.__once_event_listener_map[type][raw_listener] = wrapper
                listener = wrapper
            self.__listeners[type].add(listener)

    def remove_listener(self, type: EventType, listener: EventListener):
        with self.__lock:
            wrapper = self.__once_event_listener_map[type].pop(listener, None)
            if wrapper:
                self.__listeners[type].discard(wrapper)
                return
            self.__listeners[type].discard(listener)

    def remove_all_listeners(self, type: EventType):
        with self.__lock:
            self.__listeners[type].clear()
            self.__once_event_listener_map[type].clear()

    def dispatch_event(self, type: EventType, *args):
        with self.__lock:
            for listener in self.__listeners[type].copy():
                try:
                    listener(*args)
                except Exception as e:
                    # 捕获异常避免影响其他监听器
                    print(f"事件监听器执行异常 - 事件类型: {type}")
                    print(f"异常信息: {str(e)}")
                    print("堆栈跟踪:")
                    traceback.print_exc()

    @staticmethod
    def dispatch_js_event(web_name: str, type: str, args: list | tuple = []):
        from .AxonGUI import AxonGUI

        return AxonGUI.post(web_name, "AxonEvent", "dispatchEvent", [type, *args])

    @staticmethod
    def dispatch_js_event_batch(
        type: str, args: list | tuple = [], web_names: Literal["*"] | list[str] = "*"
    ):
        from .AxonGUI import AxonGUI

        _web_names = AxonGUI.get_web_names() if web_names == "*" else web_names
        return [_AxonEvent.dispatch_js_event(wn, type, args) for wn in _web_names]


AxonEvent = _AxonEvent()
AxonController.register(AxonEvent)

"""JS -> Python：把页面发来的调用分发给 Python 控制器。

两条信号进、一条队列出：

* ``onCall`` 收 JS 发来的一条消息（可能是攒批后的 ``{"batch": [...]}``）；
* 每个调用在线程池（同步方法）或 ``controller_loop``（``async def``）里跑；
* 结果统一进 ``_pending``，由 ``_flush_pending`` 在主线程一次性 emit 回去
  （一条就发单条信号，多条发批量信号）。
"""

from __future__ import annotations

import asyncio
import inspect
import os
import threading
import traceback
from collections import defaultdict
from concurrent.futures.thread import ThreadPoolExecutor
from typing import (
    TYPE_CHECKING,
    Any,
    Callable,
    cast,
    Literal,
    Optional,
    TypeVar,
    TypedDict,
)

from PySide6.QtCore import QMetaObject, QObject, Qt, Signal, Slot

from .AxonCodec import decode as codec_decode
from .AxonCodec import encode as codec_encode
from .AxonPYCall import call

if TYPE_CHECKING:
    from .AxonGUI import AxonGUI

WebName = str
ControllerId = str
ControllerPropName = str
CallId = str

T = TypeVar("T")


class ClassInfo(TypedDict):
    klass: type[object]
    shared: bool


controllerClassDict: dict[WebName, dict[ControllerId, ClassInfo]] = defaultdict(dict)
controllerDict: dict[WebName, dict[ControllerId, object]] = defaultdict(dict)
shared_controllers: dict[ControllerId, object] = {}
# 注册到 "*" 的实例（AxonEvent / AxonStore 这类全局对象）: 之后新建的窗口也要挂上
globalControllers: dict[ControllerId, object] = {}


def AxonControllerDecorator(
    web_name: WebName | list[WebName] = "*",
    id: Optional[ControllerId] = None,
    shared: bool = False,
) -> Callable[[type[T]], type[T]]:
    """把类注册成某个窗口（或所有窗口）的控制器。"""
    if isinstance(web_name, str):
        web_name = [web_name]

    def decorator(cls: type[T]) -> type[T]:
        controller_id = cls.__name__ if id is None else id
        for web_name_item in web_name:
            controllerClassDict[web_name_item][controller_id] = ClassInfo(
                klass=cls, shared=shared
            )
        return cls

    return decorator


class _AxonController:
    """``AxonController`` 的命名空间对象：既能当装饰器用，也挂注册表操作。"""

    if TYPE_CHECKING:  # 只给类型检查器看，运行期在模块底部绑定真实现
        auto_register: Callable[[AxonGUI], None]
        get: Callable[[WebName, ControllerId], object]
        get_attr: Callable[[WebName, ControllerId, ControllerPropName], Any]
        get_prop: Callable[
            [WebName, ControllerId, ControllerPropName], Callable[..., Any]
        ]
        set_prop: Callable[[WebName, ControllerId, ControllerPropName, Any], None]
        register: Callable[..., None]
        unregister: Callable[..., None]

    def __call__(
        self,
        web_name: WebName | list[WebName] = "*",
        id: Optional[ControllerId] = None,
        shared: bool = False,
    ) -> Callable[[type[T]], type[T]]:
        """注册类到 AxonController。

        :param web_name: 不填则注册到所有网页
        :param id: 不传则与类名一致
        :param shared: 网页间是否共享实例
        """
        return AxonControllerDecorator(web_name, id, shared)


AxonController = _AxonController()


def auto_register(web: AxonGUI) -> None:
    """给新窗口挂上该有的控制器实例（全局实例 + 类注册）。"""
    # 先挂全局实例（register 到 "*" 的）, 再让类注册的逐 web 实例覆盖同名 id
    for controller_id, controller in globalControllers.items():
        controllerDict[web.web_name][controller_id] = controller
    class_dict = controllerClassDict.get("*", {}) | controllerClassDict.get(
        web.web_name, {}
    )
    for controller_id, class_info in class_dict.items():
        if class_info["shared"]:
            controller = shared_controllers.get(controller_id)
            if controller is None:
                controller = class_info["klass"]()
                shared_controllers[controller_id] = controller
        else:
            controller = class_info["klass"]()
        controllerDict[web.web_name][controller_id] = controller


def get(web_name: WebName, controller_id: ControllerId) -> object:
    """取某个窗口下的控制器实例；没有就报错。"""
    controller = controllerDict[web_name].get(controller_id)
    if controller is None:
        raise RuntimeError(f"Controller {controller_id} of Web {web_name} not found")
    return controller


def get_attr(
    web_name: WebName, controller_id: ControllerId, prop: ControllerPropName
) -> Any:
    """取控制器上的任意属性（读属性用这个，值不一定是函数）。"""
    obj = get(web_name, controller_id)
    try:
        return getattr(obj, prop)
    except AttributeError:
        raise RuntimeError(
            f"Property {prop} of Controller {controller_id} of Web {web_name} not found"
        ) from None


def get_prop(
    web_name: WebName, controller_id: ControllerId, prop: ControllerPropName
) -> Callable[..., Any]:
    """取控制器上的一个可调用属性。"""
    value = get_attr(web_name, controller_id, prop)
    if not callable(value):
        raise RuntimeError(
            f"Property {prop} of Controller {controller_id} of Web {web_name} "
            "is not callable"
        )
    return cast(Callable[..., Any], value)


def set_prop(
    web_name: WebName,
    controller_id: ControllerId,
    prop: ControllerPropName,
    value: Any,
) -> None:
    """给控制器上的属性赋值。"""
    obj = get(web_name, controller_id)
    setattr(obj, prop, value)


def register(
    controller: object,
    web_name: WebName = "*",
    id: Optional[ControllerId] = None,
) -> None:
    """注册一个已经建好的实例（可以是全局对象）。"""
    controller_id = controller.__class__.__name__ if id is None else id
    if web_name == "*":
        globalControllers[controller_id] = controller
    controllerDict[web_name][controller_id] = controller
    if web_name == "*":
        # 注册到 "*" 也要立刻对已经创建的窗口生效, 否则运行期注册无效
        for opened_web in list(controllerDict.keys()):
            if opened_web != "*":
                controllerDict[opened_web][controller_id] = controller


def unregister(controller_id: ControllerId, web_name: WebName = "*") -> None:
    """取消注册。"""
    del controllerDict[web_name][controller_id]
    if web_name == "*":
        globalControllers.pop(controller_id, None)


# 运行期把这些函数挂到命名空间对象上（用 setattr 而不是赋值：类型上它们不是方法）
for _name, _func in (
    ("auto_register", auto_register),
    ("get", get),
    ("get_attr", get_attr),
    ("get_prop", get_prop),
    ("set_prop", set_prop),
    ("register", register),
    ("unregister", unregister),
):
    setattr(AxonController, _name, staticmethod(_func))
del _name, _func


class JSData(TypedDict, total=False):
    """JS 发来的一条调用（字段含义见文档「架构与消息流」）。"""

    call_id: CallId
    web_name: WebName
    controller_id: ControllerId
    prop: ControllerPropName
    args: list[Any]
    kwargs: dict[str, Any]
    type: Literal["call", "set", "get"]
    batch: list[JSData]


controller_loop = asyncio.new_event_loop()
controller_loop_thread = threading.Thread(
    target=lambda: controller_loop.run_forever(), daemon=True
)
controller_loop_thread.start()
controller_sync_executor = ThreadPoolExecutor(max_workers=(os.cpu_count() or 1) + 4)


class AxonJSCallHandler(QObject):
    """QWebChannel 对象 ``AxonJSCallHandler``：页面里的调用从这里进来。"""

    # 单条回包：一条消息一个结果
    returnReceiverSignal = Signal(list)
    # 批量回包：一条消息带 N 个结果。JS 侧连接这个可以少收 N-1 条消息
    returnReceiverBatchSignal = Signal(list)

    def __init__(self) -> None:
        super().__init__()
        self._pending: list[list[Any]] = []
        self._pending_lock = threading.Lock()
        self._flush_scheduled = False

    @Slot(dict)
    def onCall(self, data: JSData) -> None:
        batch = data.get("batch")
        if batch:
            # 同一轮事件循环里攒下来的调用，一条消息带过来
            for item in batch:
                self._dispatch(item)
            return
        self._dispatch(data)

    def _dispatch(self, data: JSData) -> None:
        call_id = data["call_id"]
        try:
            decoded = codec_decode(list(data.get("args") or []))
            data["args"] = decoded if isinstance(decoded, list) else [decoded]
            kwargs = data.get("kwargs") or {}
            decoded_kwargs = codec_decode(kwargs)
            data["kwargs"] = (
                decoded_kwargs if isinstance(decoded_kwargs, dict) else kwargs
            )

            if data["type"] == "set":
                AxonController.set_prop(
                    data["web_name"],
                    data["controller_id"],
                    data["prop"],
                    data["args"][0] if data["args"] else None,
                )
                self.callback(call_id, "resolve", None)
                return

            if data["type"] == "get":
                self.callback(
                    call_id,
                    "resolve",
                    AxonController.get_attr(
                        data["web_name"], data["controller_id"], data["prop"]
                    ),
                )
                return

            prop = AxonController.get_prop(
                data["web_name"], data["controller_id"], data["prop"]
            )

            if inspect.iscoroutinefunction(prop):
                asyncio.run_coroutine_threadsafe(
                    self.async_call(prop, data), controller_loop
                )
            else:
                controller_sync_executor.submit(self.sync_call, prop, data)
        except Exception:
            self.callback(call_id, "reject", traceback.format_exc())

    def callback(
        self,
        call_id: CallId,
        state: Literal["resolve", "reject"],
        _return: Any,
    ) -> None:
        """把结果排进队列，下一轮事件循环一次性发出去（可能是批量消息）。"""
        with self._pending_lock:
            self._pending.append([call_id, state, _return])
            schedule = not self._flush_scheduled
            self._flush_scheduled = True
        if schedule:
            # 从任意线程（worker / asyncio loop）都能安全地投递到主线程
            QMetaObject.invokeMethod(
                self, "_flush_pending", Qt.ConnectionType.QueuedConnection
            )

    @Slot()
    def _flush_pending(self) -> None:
        with self._pending_lock:
            self._flush_scheduled = False
            if not self._pending:
                return
            items = self._pending
            self._pending = []
        if len(items) == 1:
            self.returnReceiverSignal.emit(items[0])
        else:
            self.returnReceiverBatchSignal.emit(items)

    @staticmethod
    def _maybe_encode(web_name: WebName, value: Any) -> Any:
        """JS 声明支持压缩时才压（老前端收到压缩块会不认得）。"""
        from .AxonGUI import AxonGUI  # 局部导入：避免和 AxonGUI 的循环依赖

        web = AxonGUI.get_web(web_name)
        if web is None or not getattr(web, "_js_codec", False):
            return value
        return codec_encode(value)

    async def async_call(self, func: Callable[..., Any], data: JSData) -> None:
        """跑一个 ``async def`` 控制器方法（在 controller_loop 里）。"""
        try:
            _return = await func(*data.get("args") or [], **(data.get("kwargs") or {}))
            self.callback(
                data["call_id"], "resolve", self._maybe_encode(data["web_name"], _return)
            )
        except Exception:
            self.callback(data["call_id"], "reject", traceback.format_exc())

    def sync_call(self, func: Callable[..., Any], data: JSData) -> None:
        """跑一个普通方法（在线程池里，别让 UI 线程卡住）。"""
        try:
            _return = func(*data.get("args") or [], **(data.get("kwargs") or {}))
            self.callback(
                data["call_id"], "resolve", self._maybe_encode(data["web_name"], _return)
            )
        except Exception:
            self.callback(data["call_id"], "reject", traceback.format_exc())


class JSCrossData(TypedDict, total=False):
    """JS 发来的跨窗口请求。``action`` 缺省时按单个调用处理（兼容旧版）。"""

    action: Literal["call", "broadcast", "windows", "emit"]
    web_name: WebName
    web_names: list[WebName]
    controller_id: ControllerId
    func: ControllerPropName
    args: list[Any]
    kwargs: dict[str, Any]
    timeout: float
    type: str
    exclude: list[WebName]


@AxonController(shared=True)
class AxonCrossCallHandler:
    """JS 之间的转接台：所有跨窗口请求都落到这里，再转给目标窗口。"""

    async def onCall(self, data: JSCrossData) -> Any:
        from . import AxonCross

        action = data.get("action") or "call"
        if action == "windows":
            return AxonCross.windows()
        if action == "call":
            return await AxonCross._wait_call(data)
        if action == "broadcast":
            futures = AxonCross.broadcast(
                data["controller_id"],
                data["func"],
                *(data.get("args") or []),
                kwargs=data.get("kwargs"),
                timeout=_to_seconds(data.get("timeout")),
                exclude=data.get("exclude") or (),
            )
            return await AxonCross._wait_all(futures, data.get("timeout"))
        if action == "emit":
            emitted = AxonCross.emit(
                data["type"],
                *(data.get("args") or []),
                exclude=data.get("exclude") or (),
            )
            return {"count": len(emitted)}
        raise ValueError(f"不认识的跨窗口请求: {action}")


def _to_seconds(timeout_ms: float | None) -> float | None:
    return None if timeout_ms is None else max(timeout_ms, 0) / 1000.0

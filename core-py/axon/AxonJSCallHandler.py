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
    Literal,
    Optional,
    Type,
    TypedDict,
    cast,
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


class ClassInfo(TypedDict):
    klass: Type[object]
    shared: bool


controllerClassDict = defaultdict[WebName, dict[ControllerId, ClassInfo]](dict)
controllerDict = defaultdict[WebName, dict[ControllerId, object]](dict)
shared_controllers: dict[ControllerId, object] = {}
# 注册到 "*" 的实例（AxonEvent / AxonStore 这类全局对象）: 之后新建的窗口也要挂上
globalControllers: dict[ControllerId, object] = {}


def AxonControllerDecorator(
    web_name: WebName | list[WebName] = "*",
    id: Optional[ControllerId] = None,
    shared: bool = False,
):
    if isinstance(web_name, str):
        web_name = [web_name]

    def decorator[T: object](cls: Type[T]):
        _controller_id = cls.__name__ if id is None else id
        for web_name_item in web_name:
            controllerClassDict[web_name_item][_controller_id] = ClassInfo(
                klass=cls, shared=shared
            )
        return cls

    return decorator


class _AxonControllerDecorator:
    def __call__[T: object](self, cls: Type[T]) -> Type[T]: ...


class _AxonController:
    def __call__(
        self,
        web_name: WebName | list[WebName] = "*",
        id: Optional[ControllerId] = None,
        shared: bool = False,
    ) -> _AxonControllerDecorator:
        """注册类到AxonController :param web_name: 不填则注册到所有网页 :param id: 不传则与类名一致 :param shared: 网页间是否共享实例"""
        ...

    def auto_register(self, web: AxonGUI): ...
    def get(self, web_name: WebName, controller_id: ControllerId) -> object:
        """获取controller"""
        ...

    def get_prop(
        self, web_name: WebName, controller_id: ControllerId, prop: ControllerPropName
    ) -> Callable:
        """获取controller的函数"""
        ...

    def set_prop(
        self,
        web_name: WebName,
        controller_id: ControllerId,
        prop: ControllerPropName,
        value: Any,
    ):
        """设置controller的属性"""
        ...

    def register(
        self,
        controller: object,
        web_name: WebName = "*",
        id: Optional[ControllerId] = None,
    ):
        """注册自定义的controller"""
        ...

    def unregister(self, controller_id: ControllerId, web_name: WebName = "*"):
        """取消注册的controller"""
        ...


AxonController = cast(_AxonController, AxonControllerDecorator)


def auto_register(web: AxonGUI):
    # 先挂全局实例（register 到 "*" 的）, 再让类注册的逐 web 实例覆盖同名 id
    for controller_id, controller in globalControllers.items():
        controllerDict[web.web_name][controller_id] = controller
    class_dict = controllerClassDict.get("*", {}) | controllerClassDict.get(
        web.web_name, {}
    )
    for controller_id, class_info in class_dict.items():
        if class_info["shared"]:
            controller = shared_controllers.get(controller_id, class_info["klass"]())
            shared_controllers[controller_id] = controller
        else:
            controller = class_info["klass"]()
        controllerDict[web.web_name][controller_id] = controller


AxonController.auto_register = auto_register


def get(web_name, controller_id):
    controller = controllerDict[web_name].get(controller_id)
    if controller is None:
        raise RuntimeError(f"Controller {controller_id} of Web {web_name} not found")
    return controller


def get_prop(web_name, controller_id, prop):
    obj = get(web_name, controller_id)
    try:
        return getattr(obj, prop)
    except AttributeError:
        raise RuntimeError(
            f"Property {prop} of Controller {controller_id} of Web {web_name} not found"
        ) from None


def set_prop(web_name, controller_id, prop, value):
    obj = get(web_name, controller_id)
    setattr(obj, prop, value)


AxonController.get = get
AxonController.get_prop = get_prop
AxonController.set_prop = set_prop


def register(
    controller: object,
    web_name: WebName = "*",
    id: Optional[ControllerId] = None,
):
    if id is None:
        id = controller.__class__.__name__
    if web_name == "*":
        globalControllers[id] = controller
    controllerDict[web_name][id] = controller
    if web_name == "*":
        # 注册到 "*" 也要立刻对已经创建的窗口生效, 否则运行期注册无效
        for opened_web in list(controllerDict.keys()):
            if opened_web != "*":
                controllerDict[opened_web][id] = controller


def unregister(controller_id: ControllerId, web_name: WebName = "*"):
    del controllerDict[web_name][controller_id]
    if web_name == "*":
        globalControllers.pop(controller_id, None)


AxonController.register = register
AxonController.unregister = unregister
# 处理JS发起的call
CallId = str


class JSData(TypedDict):
    call_id: CallId
    web_name: WebName
    controller_id: ControllerId
    prop: ControllerPropName
    args: list
    kwargs: dict
    type: Literal["call", "set", "get"]


controller_loop = asyncio.new_event_loop()
controller_loop_thread = threading.Thread(
    target=lambda: controller_loop.run_forever(), daemon=True
)
controller_loop_thread.start()
controller_sync_executor = ThreadPoolExecutor(max_workers=(os.cpu_count() or 1) + 4)


# 用于处理/分发前端的call请求
class AxonJSCallHandler(QObject):
    # 单条回包：一条消息一个结果
    returnReceiverSignal = Signal(list)
    # 批量回包：一条消息带 N 个结果。JS 侧连接这个可以少收 N-1 条消息
    returnReceiverBatchSignal = Signal(list)

    def __init__(self):
        super().__init__()
        self._pending: list[list] = []
        self._pending_lock = threading.Lock()
        self._flush_scheduled = False

    @Slot(dict)
    def onCall(self, data: JSData):
        batch = data.get("batch") if isinstance(data, dict) else None
        if batch:
            # 同一轮事件循环里攒下来的调用，一条消息带过来
            for item in batch:
                self._dispatch(item)
            return
        self._dispatch(data)

    def _dispatch(self, data: JSData):
        try:
            data["args"] = codec_decode(list(data.get("args") or []))
            kwargs = data.get("kwargs") or {}
            data["kwargs"] = codec_decode(kwargs) if isinstance(kwargs, dict) else kwargs
            if data["type"] == "set":
                data["args"] = [
                    codec_decode(item) for item in (data.get("args") or [])
                ]
                AxonController.set_prop(
                    data["web_name"],
                    data["controller_id"],
                    data["prop"],
                    data["args"][0] if data["args"] else None,
                )
                self.callback(data["call_id"], "resolve", None)
                return
            prop = AxonController.get_prop(
                data["web_name"], data["controller_id"], data["prop"]
            )
            if data["type"] == "get":
                self.callback(data["call_id"], "resolve", prop)
                return

            if inspect.iscoroutinefunction(prop):
                asyncio.run_coroutine_threadsafe(
                    self.async_call(prop, data), controller_loop
                )
            else:
                controller_sync_executor.submit(self.sync_call, prop, data)
        except Exception:
            self.callback(data["call_id"], "reject", traceback.format_exc())

    def callback(
        self,
        call_id: CallId,
        state: Literal["resolve", "reject"],
        _return: Any,
    ):
        """把结果排进队列，下一轮事件循环一次性发出去（可能是批量消息）。"""
        with self._pending_lock:
            self._pending.append([call_id, state, _return])
            schedule = not self._flush_scheduled
            self._flush_scheduled = True
        if schedule:
            # 从任意线程（worker / asyncio loop）都能安全地投递到主线程
            QMetaObject.invokeMethod(self, "_flush_pending", Qt.QueuedConnection)

    @Slot()
    def _flush_pending(self):
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

    async def async_call(self, func, data: JSData):
        try:
            _return = await func(*data["args"], **(data.get("kwargs") or {}))
            self.callback(
                data["call_id"], "resolve", self._maybe_encode(data["web_name"], _return)
            )
        except Exception:
            self.callback(data["call_id"], "reject", traceback.format_exc())

    def sync_call(self, func, data: JSData):
        try:
            _return = func(*data["args"], **(data.get("kwargs") or {}))
            self.callback(
                data["call_id"], "resolve", self._maybe_encode(data["web_name"], _return)
            )
        except Exception:
            self.callback(data["call_id"], "reject", traceback.format_exc())


class JSCrossData(TypedDict, total=False):
    """JS 发来的跨窗口请求。`action` 缺省时按单个调用处理（兼容旧版）。"""

    action: Literal["call", "broadcast", "windows", "emit"]
    web_name: WebName
    web_names: list[WebName]
    controller_id: ControllerId
    func: ControllerPropName
    args: list
    kwargs: dict
    timeout: float
    type: str
    exclude: list[WebName]


@AxonController(shared=True)
class AxonCrossCallHandler:
    """JS 之间的转接台：所有跨窗口请求都落到这里，再转给目标窗口。"""

    async def onCall(self, data: JSCrossData):
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
            futures = AxonCross.emit(
                data["type"],
                *(data.get("args") or []),
                exclude=data.get("exclude") or (),
            )
            return {"count": len(futures)}
        raise ValueError(f"不认识的跨窗口请求: {action}")


def _to_seconds(timeout_ms: float | None) -> float | None:
    return None if timeout_ms is None else max(timeout_ms, 0) / 1000.0

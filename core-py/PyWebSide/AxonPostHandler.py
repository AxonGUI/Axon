from __future__ import annotations
import asyncio
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
from PySide6.QtCore import QObject, Signal, Slot
from .AxonGUIPost import post

if TYPE_CHECKING:
    from .AxonGUI import AxonGUI
WebName = str
ControllerId = str
ControllerFuncName = str


class ClassInfo(TypedDict):
    klass: Type[object]
    shared: bool


controllerClassDict = defaultdict[WebName, dict[ControllerId, ClassInfo]](dict)
controllerDict = defaultdict[WebName, dict[ControllerId, object]](dict)
shared_controllers: dict[ControllerId, object] = {}


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

    def _register_to_web(self, web: AxonGUI): ...
    def get(self, web_name: WebName, controller_id: ControllerId) -> object:
        """获取controller"""
        ...

    def get_func(
        self, web_name: WebName, controller_id: ControllerId, func: ControllerFuncName
    ) -> Callable:
        """获取controller的函数"""
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


def register_to_web(web: AxonGUI):
    # 注册内置channel
    from .AxonEnv import AxonEnv
    from .AxonGUIPost import AxonPost

    web.registerChannel("AxonEnv", AxonEnv(web))
    web.registerChannel("AxonPostHandler", AxonPostHandler())
    web.registerChannel("AxonPost", AxonPost())
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


AxonController._register_to_web = register_to_web


def get(web_name, controller_id):
    controller = controllerDict[web_name].get(controller_id)
    if controller is None:
        raise RuntimeError(f"Controller {controller_id} of Web {web_name} not found")
    return controller


def get_func(web_name, controller_id, func):
    func = getattr(get(web_name, controller_id), func)
    if func is None:
        raise RuntimeError(
            f"Function {func} of Controller {controller_id} of Web {web_name} not found"
        )
    return func


AxonController.get = get
AxonController.get_func = get_func


def register(
    controller: object,
    web_name: WebName = "*",
    id: Optional[ControllerId] = None,
):
    if id is None:
        id = controller.__class__.__name__
    controllerDict[web_name][id] = controller


def unregister(controller_id: ControllerId, web_name: WebName = "*"):
    del controllerDict[web_name][controller_id]


AxonController.register = register
AxonController.unregister = unregister
# 处理JS发起的post
PostId = str


class JSPostData(TypedDict):
    post_id: PostId
    web_name: WebName
    controller_id: ControllerId
    func: ControllerFuncName
    args: list
    kwargs: dict


controller_loop = asyncio.new_event_loop()
controller_loop_thread = threading.Thread(
    target=lambda: controller_loop.run_forever(), daemon=True
)
controller_loop_thread.start()
controller_sync_executor = ThreadPoolExecutor(max_workers=(os.cpu_count() or 1) + 4)


# 用于处理/分发前端的post请求
class AxonPostHandler(QObject):
    responseReceiverSignal = Signal(list)

    def __init__(self):
        super().__init__()

    @Slot(dict)
    def onPost(self, data: JSPostData):
        try:
            func = AxonController.get_func(
                data["web_name"], data["controller_id"], data["func"]
            )
            if asyncio.iscoroutinefunction(func):
                asyncio.run_coroutine_threadsafe(
                    self.async_wait_call_js_post_callback(func, data), controller_loop
                )
            else:
                controller_sync_executor.submit(
                    self.wait_call_js_post_callback, func, data
                )
        except Exception:
            self.callback(data["post_id"], "reject", traceback.format_exc())

    def callback(
        self,
        post_id: PostId,
        state: Literal["resolve", "reject"],
        _return: Any,
    ):
        self.responseReceiverSignal.emit([post_id, state, _return])

    async def async_wait_call_js_post_callback(self, func, data: JSPostData):
        try:
            _return = await func(*data["args"], **data["kwargs"])
            self.callback(data["post_id"], "resolve", _return)
        except Exception:
            self.callback(data["post_id"], "reject", traceback.format_exc())

    def wait_call_js_post_callback(self, func, data: JSPostData):
        try:
            _return = func(*data["args"], **data["kwargs"])
            self.callback(data["post_id"], "resolve", _return)
        except Exception:
            self.callback(data["post_id"], "reject", traceback.format_exc())


class JSCrossPostData(TypedDict):
    web_name: WebName
    controller_id: ControllerId
    func: ControllerFuncName
    args: list


@AxonController(shared=True)
class AxonCrossPostHandler:
    async def onPost(self, data: JSCrossPostData):
        future = post(**data)
        return await asyncio.wrap_future(future)

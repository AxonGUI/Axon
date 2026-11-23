from __future__ import annotations

import uuid
from concurrent.futures import Future
from types import SimpleNamespace
from typing import TYPE_CHECKING, Any, Literal, TypedDict

from PySide6.QtCore import QObject, Signal, Slot

if TYPE_CHECKING:
    from .AxonJSCallHandler import ControllerId, ControllerPropName, WebName
CallId = str
callFutures: dict[CallId, Future] = {}


class AxonFuture(Future):
    """Python -> JS 调用的返回句柄。

    ``concurrent.futures.Future`` 不能被 ``await``, 这里补一个 asyncio 桥接:
    ``await Axon("web").Ctl.func(...)`` 与 ``.result()`` 都能用。
    """

    def __await__(self):
        import asyncio

        return asyncio.wrap_future(self).__await__()


def cancel(call_id: CallId):
    future = callFutures.pop(call_id, None)
    if future:
        return future.cancel()
    return False


def _call(
    web_name: WebName,
    controller_id: ControllerId,
    prop: ControllerPropName,
    args: list | tuple = (),
    type: Literal["call", "set", "get"] = "call",
    kwargs: dict | None = None,
):
    from .AxonGUI import AxonGUI

    future = AxonFuture()
    web = AxonGUI.get_web(web_name)
    if web is None:
        future.set_exception(RuntimeError(f"web `{web_name}` not found"))
        return future

    call_id = str(uuid.uuid4())
    callFutures[call_id] = future
    future.cancel = lambda: cancel(call_id)
    data = {
        "call_id": call_id,
        "controller_id": controller_id,
        "prop": prop,
        "args": list(args),
        "kwargs": kwargs or {},
        "type": type,
    }
    axon_call: AxonPYCall = web.get_channel("AxonPYCall")  # pyright: ignore[reportAssignmentType]
    axon_call.onCallSignal.emit(data)
    return future


def call(
    web_name: WebName,
    controller_id: ControllerId,
    func: ControllerPropName,
    args: list | tuple = (),
    kwargs: dict | None = None,
):
    return _call(web_name, controller_id, func, args, "call", kwargs=kwargs)


def setVar(
    web_name: WebName,
    controller_id: ControllerId,
    var_name: ControllerPropName,
    value: Any,
):
    return _call(web_name, controller_id, var_name, [value], "set")


def getVar(
    web_name: WebName,
    controller_id: ControllerId,
    var_name: ControllerPropName,
):
    return _call(web_name, controller_id, var_name, type="get")


def broadcast(
    controller_id: ControllerId,
    func: ControllerPropName,
    args: list | tuple = (),
    kwargs: dict | None = None,
):
    from .AxonGUI import AxonGUI

    futures: list[Future] = []
    for web_name in AxonGUI.get_web_names():
        futures.append(call(web_name, controller_id, func, args, kwargs=kwargs))
    return futures


#: 四个模块级函数的命名空间别名（`AxonCall.call(...)` 与 `call(...)` 是同一份实现）
AxonCall = SimpleNamespace(call=call, setVar=setVar, getVar=getVar, broadcast=broadcast)


class JSRuntimeError(RuntimeError):
    pass


class JSRetData(TypedDict):
    call_id: CallId
    state: Literal["resolve", "reject"]
    data: Any


class AxonPYCall(QObject):
    onCallSignal = Signal(dict)
    hasControllerSignal = Signal(dict)

    @Slot(dict)
    def returnReceiver(self, data: JSRetData):
        future = callFutures.pop(data.get("call_id"), None)
        if not future or future.done():
            return
        if data["state"] == "resolve":
            future.set_result(data.get("data"))
        else:
            future.set_exception(JSRuntimeError(data["data"]))

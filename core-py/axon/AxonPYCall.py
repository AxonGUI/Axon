from __future__ import annotations

import uuid
from concurrent.futures import Future
from typing import TYPE_CHECKING, Any, Literal, TypedDict

from PySide6.QtCore import QObject, Signal, Slot

if TYPE_CHECKING:
    from .AxonJSCallHandler import ControllerId, ControllerPropName, WebName
CallId = str
callFutures: dict[CallId, Future] = {}


def cancel(call_id: CallId):
    future = callFutures.pop(call_id, None)
    if future:
        return future.cancel()
    return False


def __call__(
    web_name: WebName,
    controller_id: ControllerId,
    prop: ControllerPropName,
    args: list | tuple = [],
    type: Literal["call", "set", "get"] = "call",
):
    from .AxonGUI import AxonGUI

    future = Future()
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
        "args": args,
        "type": type,
    }
    axon_call: AxonPYCall = web.get_channel("AxonCall")  # pyright: ignore[reportAssignmentType]
    axon_call.onCallSignal.emit(data)
    return future


def call(
    web_name: WebName,
    controller_id: ControllerId,
    func: ControllerPropName,
    args: list | tuple = [],
):
    return __call__(web_name, controller_id, func, args, "call")


def setVar(
    web_name: WebName,
    controller_id: ControllerId,
    var_name: ControllerPropName,
    value: Any,
):
    return __call__(web_name, controller_id, var_name, [value], "set")


def getVar(
    web_name: WebName,
    controller_id: ControllerId,
    var_name: ControllerPropName,
):
    return __call__(web_name, controller_id, var_name, type="get")


def broadcast(
    controller_id: ControllerId,
    func: ControllerPropName,
    args: list | tuple = [],
):
    from .AxonGUI import AxonGUI

    futures: list[Future] = []
    for web_name in AxonGUI.get_web_names():
        futures.append(call(web_name, controller_id, func, args))
    return futures


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

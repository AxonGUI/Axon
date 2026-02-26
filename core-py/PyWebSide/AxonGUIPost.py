from __future__ import annotations
import uuid
from concurrent.futures import Future
from typing import TYPE_CHECKING, Any, Literal, TypedDict
from PySide6.QtCore import QObject, Signal, Slot

if TYPE_CHECKING:
    from .AxonPostHandler import ControllerFuncName, ControllerId, WebName
PostId = str
postFutures: dict[PostId, Future] = {}


def cancel(post_id: PostId):
    future = postFutures.pop(post_id, None)
    if future:
        return future.cancel()
    return False


def post(
    web_name: WebName,
    controller_id: ControllerId,
    func: ControllerFuncName,
    args: list | tuple = [],
):
    from .AxonGUI import AxonGUI

    future = Future()
    post_id = str(uuid.uuid4())
    postFutures[post_id] = future
    future.cancel = lambda: cancel(post_id)
    data = {
        "post_id": post_id,
        "controller_id": controller_id,
        "func_name": func,
        "args": args,
    }
    web = AxonGUI.get_web(web_name)
    if web is None:
        future.set_exception(RuntimeError(f"web `{web_name}` not found"))
        return future
    axon_post: AxonPost = web.get_channel("AxonPost")  # pyright: ignore[reportAssignmentType]
    axon_post.onPostSignal.emit(data)
    return future


def broadcast(
    controller_id: ControllerId,
    func: ControllerFuncName,
    args: list | tuple = [],
):
    from .AxonGUI import AxonGUI

    futures: list[Future] = []
    for web_name in AxonGUI.get_web_names():
        futures.append(post(web_name, controller_id, func, args))
    return futures


class JSRuntimeError(RuntimeError):
    pass


class JSPostRetData(TypedDict):
    post_id: PostId
    state: Literal["resolve", "reject"]
    data: Any


class AxonPost(QObject):
    onPostSignal = Signal(dict)
    hasControllerSignal = Signal(dict)

    @Slot(dict)
    def responseReceiver(self, data: JSPostRetData):
        future = postFutures.pop(data.get("post_id"), None)
        if not future or future.done():
            return
        if data["state"] == "resolve":
            future.set_result(data.get("data"))
        else:
            future.set_exception(JSRuntimeError(data["data"]))
